--=================================================================
--  Cluster HUD — data layer
--
--  Collects game state, diffs it and pushes only real changes to the
--  NUI page through SendNUIMessage. Nothing here draws anything.
--
--  NUI CONTRACT (html/js/main.js + render.js)
--    { action = "hud", <partial fields> }          -- state diff
--    { action = "config", accent, lowFuel, radar } -- one-shot setup
--    NUI -> Lua: POST https://<res>/uiReady        -- page handshake
--
--  FIELDS
--    visible, drive                       -- mode
--    time, night, weather, temperature    -- clock / sky
--    street, postal, direction            -- address pill
--    speed, unit, gear, fuel, delta, limit, cruise, seatbelt  -- panel
--    mic (off|idle|talking), radioChannel, radioTalking       -- voice
--
--  INTEGRATIONS (all optional, degrade gracefully)
--    pma-voice            mic/radio state
--    gears                GetGearLabel() -> P/R/N/D/S selector
--    location             postal database is read from its folder
--    location:updateTemp  real temperature event (old HUD server part)
--    exports.hud:setSpeedLimit(n) / event hud:setSpeedLimit
--    exports.hud:setTemperature(c) / event hud:setTemperature
--=================================================================

local RESOURCE = GetCurrentResourceName()

local uiReady = false
local sent = {}   -- last pushed value per field; guards JSON churn

------------------------------------------------------------------
-- POSTAL DATABASE
------------------------------------------------------------------

local postals = {}

local function applyPostals(list, source)
    postals = list
    print(('[hud] postals loaded: %d (%s)'):format(#list, source))
end

local function decodePostals(raw, source)
    local ok, data = pcall(json.decode, raw)
    if ok and type(data) == 'table' and #data > 0 then
        applyPostals(data, source)
        return true
    end
    return false
end

local function loadPostals()
    -- Embedded table (client/postals.lua) — always present, zero I/O.
    if type(HUD_POSTALS) == 'table' and #HUD_POSTALS > 0 then
        applyPostals(HUD_POSTALS, 'embedded')
        return true
    end

    print('[hud] ERROR: HUD_POSTALS is nil — client/postals.lua did not load, check fxmanifest and the script error above')

    local raw = LoadResourceFile(RESOURCE, 'new-postals.json')
    print(('[hud] client new-postals.json: %s'):format(raw and (#raw .. ' bytes') or 'not streamed'))
    if raw and raw ~= '' and decodePostals(raw, 'client file') then return true end

    raw = LoadResourceFile('location', 'new-postals.json')
    if raw and raw ~= '' and decodePostals(raw, 'location resource') then return true end

    -- Server reads the file from disk and streams it (works even when the
    -- file was not streamed to this client with the manifest).
    TriggerServerEvent('hud:requestPostals')
    return false
end

RegisterNetEvent('hud:setPostals', function(list)
    if type(list) == 'table' and #list > 0 and #postals == 0 then
        applyPostals(list, 'server')
    end
end)

local function nearestPostal(coords)
    local best, bestD = '----', math.huge
    for i = 1, #postals do
        local p = postals[i]
        local dx, dy = coords.x - p.x, coords.y - p.y
        local d = dx * dx + dy * dy
        if d < bestD then bestD, best = d, tostring(p.code) end
    end
    return best
end

------------------------------------------------------------------
-- STREET NAME — passed through as-is from GTA natives.
-- No forced translation, no abbreviation: the game's current locale
-- is the source of truth (GTA returns the English name when the
-- resource's client_language / game language is English).
------------------------------------------------------------------

local abbr = {
    { 'Boulevard', 'Blvd.' }, { 'Freeway', 'Fwy.' },
    { 'Highway',   'Hwy.' },  { 'Parkway',  'Pkwy.' },
    { 'Avenue',    'Ave.' },  { 'Street',   'St.' },
    { 'Drive',     'Dr.' },   { 'Road',     'Rd.' },
}

local function localizeStreet(rawName)
    local name = rawName
    for _, pair in ipairs(abbr) do
        name = string.gsub(name, pair[1], pair[2])
    end
    return name
end

local function streetOf(coords)
    local hash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    return localizeStreet(GetStreetNameFromHashKey(hash) or '')
end

------------------------------------------------------------------
-- CLOCK / WEATHER
------------------------------------------------------------------

-- US style: "9:07 AM" / "10:45 PM"
local function clockNow()
    local h = GetClockHours()
    local suffix = h < 12 and 'AM' or 'PM'
    h = h % 12
    if h == 0 then h = 12 end
    return string.format('%d:%02d %s', h, GetClockMinutes(), suffix)
end

local function isNight()
    local h = GetClockHours()
    return h >= (Config.NightFromHour or 20) or h < (Config.NightToHour or 6)
end

local WX_BY_NAME = {
    EXTRASUNNY = 'sun', CLEAR = 'sun',
    NEUTRAL = 'cloud', CLOUDS = 'cloud', SMOG = 'cloud',
    OVERCAST = 'cloud', CLEARING = 'cloud',
    FOGGY = 'fog', HALLOWEEN = 'fog',
    RAIN = 'rain', THUNDER = 'thunder',
    SNOW = 'snow', SNOWLIGHT = 'snow', BLIZZARD = 'snow', XMAS = 'snow',
}

local wxByHash = {}
for name, key in pairs(WX_BY_NAME) do wxByHash[GetHashKey(name)] = key end

local function weatherIcon()
    local from, to, percent = GetWeatherTypeTransition()
    percent = tonumber(percent) or 0.0
    if percent > 1.0 then percent = percent / 100.0 end
    local hash = (percent >= 0.5) and to or from
    return wxByHash[hash] or wxByHash[from] or 'cloud'
end

------------------------------------------------------------------
-- TEMPERATURE (real via event, weather estimate as fallback)
------------------------------------------------------------------

local WEATHER_TEMPS_C = {
    EXTRASUNNY = 29, CLEAR = 24, SMOG = 22, CLOUDS = 20, CLEARING = 18,
    OVERCAST = 17, FOGGY = 15, RAIN = 14, THUNDER = 13, HALLOWEEN = 16,
    SNOWLIGHT = 1, SNOW = 0, XMAS = 2, BLIZZARD = -4,
}

local tempByHash = {}
for name, value in pairs(WEATHER_TEMPS_C) do tempByHash[GetHashKey(name)] = value end

local function weatherTempC()
    local from, to, percent = GetWeatherTypeTransition()
    percent = tonumber(percent) or 0.0
    if percent > 1.0 then percent = percent / 100.0 end
    local a, b = tempByHash[from], tempByHash[to]
    if not a and not b then return nil end
    if not a then return b end
    if not b then return a end
    return a + (b - a) * percent
end

local TEMP_KVP = 'cluster_hud_last_temp'
local tempC = nil
local lastKvpWrite = 0

local function temperatureText()
    local unit = string.upper(Config.TempUnit or 'C')
    if unit == 'F' then
        return ('%d°F'):format(math.floor(tempC * 9.0 / 5.0 + 32.0 + 0.5))
    end
    return ('%d°'):format(math.floor(tempC + 0.5))
end

local function setTemperature(celsius)
    if type(celsius) ~= 'number' then return end
    tempC = celsius
    -- Throttle KVP writes to at most once per 30 seconds
    local now = GetGameTimer()
    if now - lastKvpWrite > 30000 then
        lastKvpWrite = now
        SetResourceKvp(TEMP_KVP, string.format('%.1f', celsius))
    end
    if uiReady then
        SendNUIMessage({ action = 'hud', temperature = temperatureText() })
    end
end

RegisterNetEvent('location:updateTemp', function(c) setTemperature(c) end)
RegisterNetEvent('hud:setTemperature', function(c) setTemperature(c) end)
exports('setTemperature', setTemperature)

------------------------------------------------------------------
-- VOICE (pma-voice aware, degrades gracefully)
------------------------------------------------------------------

local radioTalking = false

RegisterNetEvent('pma-voice:radioActive', function(state)
    radioTalking = state == true
end)

local function micState()
    if not MumbleIsConnected() then return 'off' end
    if type(MumbleIsVoiceMuted) == 'function' and MumbleIsVoiceMuted() then return 'off' end
    if NetworkIsPlayerTalking(PlayerId()) then return 'talking' end
    return 'idle'
end

local function radioChannel()
    local state = LocalPlayer.state
    local ch = state and state.radioChannel
    if type(ch) == 'number' and ch > 0 then return math.floor(ch) end
    return 0
end

------------------------------------------------------------------
-- DRIVE TELEMETRY
------------------------------------------------------------------

local function speedOf(vehicle)
    local multiplier = (string.upper(Config.Unit or 'KMH') == 'MPH') and 2.236936 or 3.6
    return math.floor(GetEntitySpeed(vehicle) * multiplier + 0.5)
end

-- Manual gearbox resource knows about S; otherwise the game's own R/N/D.
local function gearOf(vehicle)
    if GetResourceState('gears') == 'started' then
        local ok, label = pcall(function() return exports.gears:GetGearLabel() end)
        if ok and type(label) == 'string' and label ~= '' then
            local L = string.upper(string.sub(label, 1, 1))
            if L == 'P' or L == 'R' or L == 'N' or L == 'D' or L == 'S' then
                return L
            end
            return 'D'
        end
    end

    if GetVehicleCurrentGear(vehicle) == 0 then return 'R' end
    if GetEntitySpeed(vehicle) < 0.5 then
        return GetIsVehicleEngineRunning(vehicle) and 'N' or 'P'
    end
    return 'D'
end

local function fuelOf(vehicle)
    local state = Entity(vehicle).state
    local fuel = state and state.fuel

    if type(fuel) ~= 'number' then
        if DecorExistOn(vehicle, '_FUEL_LEVEL') then
            fuel = DecorGetFloat(vehicle, '_FUEL_LEVEL')
        else
            fuel = GetVehicleFuelLevel(vehicle)
        end
    end

    return math.floor(math.max(0.0, math.min(fuel or 0.0, 100.0)) + 0.5)
end

local function seatbeltOf(vehicle)
    local source = Config.SeatbeltSource

    if source == 'ox_target' then
        if GetResourceState('ox_target') == 'started' then
            local ok, result = pcall(exports.ox_target.isBelted, exports.ox_target)
            if ok then return result end
        end
        source = 'player' -- фолбэк, если ox_target не запущен или экспорт упал
    end

    if source == 'player' then
        local value = LocalPlayer.state[Config.SeatbeltStatebag or 'seatbelt']
        if type(value) == 'boolean' then return value end
    elseif vehicle then
        local value = Entity(vehicle).state[Config.SeatbeltStatebag or 'seatbelt']
        if type(value) == 'boolean' then return value end
    end

    return nil -- unknown: the page hides the belt icon
end

local function cruiseActive()
    return LocalPlayer.state[Config.CruiseStatebag or 'cruise'] == true
end

------------------------------------------------------------------
-- DIRECTION (4 cardinal letters)
------------------------------------------------------------------

local function directionOf(entity)
    local bearing = (360.0 - GetEntityHeading(entity)) % 360.0
    local sector = math.floor(((bearing + 45.0) % 360.0) / 90.0) + 1
    return (Config.Compass or { 'С', 'В', 'Ю', 'З' })[sector] or 'С'
end

------------------------------------------------------------------
-- VISIBILITY + TOGGLE + SPEED LIMIT
------------------------------------------------------------------

local masterOn = true
local speedLimit = Config.SpeedLimit or 50
local hiddenStreak = 0

local function currentMode()
    if not masterOn then return 'hidden' end
    if IsPauseMenuActive() or IsScreenFadedOut() or IsCutsceneActive() then
        return 'hidden'
    end
    if IsPlayerSwitchInProgress() then return 'hidden' end
    if IsBigmapActive() or IsRadarHidden() or not IsHudPreferenceSwitchedOn() then
        return 'hidden'
    end
    return 'visible'
end

-- Some natives (radar visibility above all) blip for a single tick when
-- the game/streamed resources touch the minimap. Hiding on the first blip
-- leaves the HUD stuck mid-fade, so a hide requires several confirmations.
local function visibleNow()
    if currentMode() ~= 'visible' then
        hiddenStreak = hiddenStreak + 1
        if hiddenStreak <= 3 then return true end
        return false
    end
    hiddenStreak = 0
    return true
end

local function toggleHUD(force)
    if type(force) == 'boolean' then masterOn = force else masterOn = not masterOn end
    return masterOn
end

exports('toggleHUD', toggleHUD)

RegisterCommand(Config.ToggleCommand or 'hud', function()
    print(('[hud] %s'):format(toggleHUD() and 'shown' or 'hidden'))
end, false)

local function setSpeedLimit(limit)
    limit = tonumber(limit)
    if not limit or limit < 0 then return end
    speedLimit = math.floor(limit)
end

RegisterNetEvent('hud:setSpeedLimit', function(limit) setSpeedLimit(limit) end)
exports('setSpeedLimit', setSpeedLimit)

------------------------------------------------------------------
-- VANILLA LABELS (street/zone/vehicle names collide with the pill)
------------------------------------------------------------------

CreateThread(function()
    if Config.HideVanilla == false then return end
    while true do
        if sent.visible == true then
            HideHudComponentThisFrame(6)
            HideHudComponentThisFrame(7)
            HideHudComponentThisFrame(8)
            HideHudComponentThisFrame(9)
            Wait(0)
        else
            Wait(250)
        end
    end
end)

CreateThread(function()
    if loadPostals() then return end
    for _ = 1, 5 do
        Wait(2000)
        if #postals > 0 then return end
        TriggerServerEvent('hud:requestPostals')
    end
    print('[hud] WARNING: postal database not found, postal shows ----')
end)

------------------------------------------------------------------
-- MAIN LOOP — diff pusher
------------------------------------------------------------------

CreateThread(function()
    local wasDriving = false
    local lastDebugVisible = nil
    local placeX, placeY
    local street, postalCode = '', '----'

    while true do
        Wait(wasDriving and (Config.DriveInterval or 250) or (Config.Interval or 400))

        if uiReady then
            local out = {}

            local function put(key, value)
                if sent[key] == value then return end
                sent[key] = value
                out[key] = value
            end

            local ped = PlayerPedId()
            local visible = visibleNow()

            if Config.Debug and visible ~= lastDebugVisible then
                print(('[hud] visible -> %s (pause=%s faded=%s cutscene=%s switch=%s bigmap=%s radarHidden=%s hudPrefOff=%s streak=%d)')
                    :format(
                        tostring(visible),
                        tostring(IsPauseMenuActive()),
                        tostring(IsScreenFadedOut()),
                        tostring(IsCutsceneActive()),
                        tostring(IsPlayerSwitchInProgress()),
                        tostring(IsBigmapActive()),
                        tostring(IsRadarHidden()),
                        tostring(not IsHudPreferenceSwitchedOn()),
                        hiddenStreak))
                lastDebugVisible = visible
            end

            put('visible', visible)

            if visible then
                local vehicle = GetVehiclePedIsIn(ped, false)
                local entity = (vehicle ~= 0) and vehicle or ped
                local coords = GetEntityCoords(entity)

                local driving = vehicle ~= 0
                    and (GetPedInVehicleSeat(vehicle, -1) == ped or Config.Passenger == true)

                -- Address is heavy (postal scan): recompute only after real movement.
                local dx = placeX and (coords.x - placeX) or 0.0
                local dy = placeY and (coords.y - placeY) or 0.0
                local radius = Config.MovementRadius or 3.0
                if placeX == nil or dx * dx + dy * dy > radius * radius then
                    placeX, placeY = coords.x, coords.y
                    street = streetOf(coords)
                    postalCode = nearestPostal(coords)
                end

                put('time', clockNow())
                put('night', isNight())
                put('weather', weatherIcon())
                put('street', street)
                put('postal', postalCode)
                put('direction', directionOf(entity))
                put('unit', string.upper(Config.Unit or 'KMH'))

                put('mic', micState())
                put('radioChannel', radioChannel())
                put('radioTalking', radioTalking)

                put('drive', driving)
                if driving then
                    local speed = speedOf(vehicle)
                    put('speed', speed)
                    put('gear', gearOf(vehicle))
                    put('fuel', fuelOf(vehicle))
                    put('seatbelt', seatbeltOf(vehicle))
                    put('cruise', cruiseActive())
                    put('limit', speedLimit)
                    if speedLimit > 0 and speed > speedLimit then
                        put('delta', speed - speedLimit)
                    else
                        put('delta', 0)
                    end
                end

                wasDriving = driving
            else
                put('drive', false)
                wasDriving = false
            end

            if next(out) ~= nil then
                out.action = 'hud'
                SendNUIMessage(out)
            end
        end
    end
end)

-- Temperature fallback: cached value instantly, weather estimate later.
CreateThread(function()
    local cached = tonumber(GetResourceKvpString(TEMP_KVP) or '')
    if cached then setTemperature(cached) end

    Wait(20000)
    if tempC == nil then
        local estimate = weatherTempC()
        if estimate then setTemperature(estimate) end
    end
end)

------------------------------------------------------------------
-- HANDSHAKE + CONFIG
------------------------------------------------------------------

local function pushConfig()
    local payload = { action = 'config', accent = Config.Accent, lowFuel = Config.LowFuel or 15 }

    local cfg = Config.Radar
    if type(cfg) == 'table' then
        local radar = {}
        for _, key in ipairs({ 'cx', 'cy', 'r' }) do
            local value = tonumber(cfg[key])
            if value then radar[key] = value end
        end
        if next(radar) ~= nil then payload.radar = radar end
    end

    SendNUIMessage(payload)
end

RegisterNUICallback('uiReady', function(_, cb)
    uiReady = true
    for key in pairs(sent) do sent[key] = nil end
    pushConfig()
    if tempC then
        SendNUIMessage({ action = 'hud', temperature = temperatureText() })
    end
    cb({ ok = true })
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource == RESOURCE then
        SetNuiFocus(false, false)
    end
end)

-- On resource restart the NUI page persists but Lua state is fresh.
-- Tell the page to re-handshake so uiReady fires again.
AddEventHandler('onClientResourceStart', function(resource)
    if resource == RESOURCE then
        uiReady = false
        sent = {}
        SendNUIMessage({ action = 'reset' })
    end
end)
