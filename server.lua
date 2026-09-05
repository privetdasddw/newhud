-- Server side: reads the postal database from disk and streams it to
-- clients on request. The server always sees the resource folder, so this
-- works even when the client-side LoadResourceFile path fails.

local postals = nil

local function loadPostals()
    if postals then return postals end

    local raw = LoadResourceFile(GetCurrentResourceName(), 'new-postals.json')
    if raw and raw ~= '' then
        local ok, data = pcall(json.decode, raw)
        if ok and type(data) == 'table' and #data > 0 then
            postals = data
            print(('[hud] server loaded postals: %d'):format(#data))
        end
    end

    if not postals then
        print('[hud] server: new-postals.json not found in the resource root')
    end

    return postals
end

RegisterNetEvent('hud:requestPostals', function()
    local src = source
    if not src or src == 0 then return end

    print(('[hud] postal request from client %d'):format(src))

    local list = loadPostals()
    if list then
        TriggerClientEvent('hud:setPostals', src, list)
    end
end)
