--=================================================================
--  Cluster HUD — configuration
--  Every value here is safe to tweak live-edit; restart the resource
--  (or use /hudreload-style restart) to apply.
--=================================================================

Config = {}

------------------------------------------------------------------
-- LOOK
------------------------------------------------------------------

-- Single accent color of the whole HUD (hex).
-- Единственный функциональный цвет: превышение лимита, низкий уровень
-- топлива, разговор в микрофон, эфир радио, непристёгнутый ремень,
-- R/S-передача (активные P/N/D — белые: цвет означает состояние).
-- Всё остальное — монохром (тёмные плашки + белый/серый текст).
-- Тёплый янтарь по умолчанию. Полностью монохромный HUD — '#ffffff',
-- прежний песочный — '#d5c295'.
Config.Accent = '#f2b13c'

-- "KMH" or "MPH" — drive cluster unit.
Config.Unit = 'MPH'

-- "C" or "F" — temperature display unit (source is always Celsius).
Config.TempUnit = 'F'

-- Compass rose letters, clockwise from north. 4 cardinal directions.
-- С = север, В = восток, Ю = юг, З = запад
Config.Compass = { 'С', 'В', 'Ю', 'З' }

-- Fuel percentage at or below which the fuel row turns accent.
Config.LowFuel = 15

------------------------------------------------------------------
-- SPEED LIMIT / OVERSET DELTA
------------------------------------------------------------------

-- Default limit used for the "+N" overset badge next to the speed.
-- Change at runtime: exports.hud:setSpeedLimit(60) or the event
-- "hud:setSpeedLimit" (limit). 0 disables the badge and the delta.
Config.SpeedLimit = 50

------------------------------------------------------------------
-- VEHICLE EXTRAS (soft integrations, all optional)
------------------------------------------------------------------

-- Seatbelt: источник состояния.
-- 'ox_target'  — экспорт exports.ox_target:isBelted() из [ox]/ox_target/client/seatbelt.lua
-- 'player'     — player statebag LocalPlayer.state[SeatbeltStatebag]
-- 'entity'     — entity statebag на транспорте Entity(vehicle).state[SeatbeltStatebag]
-- Если источник недоступен/значения нет — иконка ремня скрывается.
Config.SeatbeltSource = 'ox_target'
Config.SeatbeltStatebag = 'seatbelt'

-- Cruise control: player statebag. Оставлен только для совместимости —
-- HUD его больше не отображает (поле уходит в NUI и игнорируется).
Config.CruiseStatebag = 'cruise'

------------------------------------------------------------------
-- CLOCK / WEATHER
------------------------------------------------------------------

-- Night is used only to pick the moon/sun glyph next to the clock.
Config.NightFromHour = 20
Config.NightToHour   = 6

------------------------------------------------------------------
-- BEHAVIOUR
------------------------------------------------------------------

-- Show the drive cluster to passengers as well as the driver.
Config.Passenger = false

-- Hide GTA's own street/zone/vehicle labels above the minimap.
Config.HideVanilla = true

-- Manual HUD toggle command (also exported: exports.hud:toggleHUD(force)).
Config.ToggleCommand = 'hud'

-- Print the exact reason of every show/hide to the console.
-- Leave true while debugging the transparency issue.
Config.Debug = false

-- Poll rates, ms. The main loop diffs every value before touching CEF,
-- so a parked player costs almost nothing.
Config.Interval       = 400   -- address / clock / weather / drive
Config.DriveInterval  = 250   -- faster tick while driving (speed, gear, fuel)
Config.MovementRadius = 3.0   -- meters; address is recomputed after moving this far
Config.VoiceInterval  = 100   -- mic / radio state

------------------------------------------------------------------
-- RADAR GEOMETRY OVERRIDE (vh units, same system as style tokens)
--
-- Defaults already match fh4map-1.4. Fill ONLY if a different
-- minimap resource draws the circle elsewhere:
--   Config.Radar = { cx = 20.6145, cy = 21.4255, r = 13.4255 }
------------------------------------------------------------------

Config.Radar = {
    cx = nil,
    cy = nil,
    r  = nil,
}
