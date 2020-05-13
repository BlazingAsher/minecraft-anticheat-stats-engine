const { promisify } = require("util");
const axios = require('axios').default;
const redis = require("redis");
const redisScan = require('node-redis-scan');

const client = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASS,
    db: process.env.REDIS_DB
});

const zrangeAsync = promisify(client.zrange).bind(client);

const scanner = new redisScan(client);

client.on("error", function(error) {
    console.error(error);
});

client.on("ready", function () {
    console.log("REDIS connection established.");
});

let gStats = {}

let playerMapCache = {}

async function getPlayerName(uuid) {
    if(playerMapCache[uuid] === undefined){
        try{
            let playerName = await axios.get('https://playerdb.co/api/player/minecraft/' + uuid);

            if(playerName.data["code"] === 'player.found'){
                //console.log(playerName.data)
                playerMapCache[uuid] = playerName.data["data"]["player"]["username"];
            }
        }
        catch (ex){
            console.log(ex);
        }
    }

    return playerMapCache[uuid] === undefined ? uuid : playerMapCache[uuid];

}

function refreshStats() {
    let stats = {}
    stats["compilation"] = {
        "1": [],
        "5": [],
        "10": [],
        "30": []
    }
    stats["players"] = {}
    stats["incidents"] = {}

    scanner.scan(process.env.SET_KEYPATTERN, async (err, matchingKeys) => {
        if(err) console.log(err);
        let startTime = Math.round(Date.now() / 1000);

        let incidentKeyArr = []

        for(let key of matchingKeys){
            // client.zrange(key, 0, -1, function(err, res){
            //     if(err){
            //         console.log(err);
            //         return;
            //     }
            //
            // })
            try{
                let res = await zrangeAsync(key, 0, -1);
                incidentKeyArr = incidentKeyArr.concat(res);

                // stats["players"][key] = {
                //     "1": [],
                //     "5": [],
                //     "10": [],
                //     "30": []
                // }

                stats["players"][key] = {
                    "hasIncident": false,
                    "1": [],
                    "5": [],
                    "10": [],
                    "30": []
                }

                let playerUUID = key.substring(key.indexOf(":")+1)
                stats["players"][key]["name"] = await getPlayerName(playerUUID);

                //console.log(stats["players"][key])
                //console.log(res);
            } catch (ex){
                console.log(ex);
            }
        }

        //console.log(incidentKeyArr);

        let clientMulti = client.multi();

        for(let incidentKey of incidentKeyArr){
            clientMulti.hgetall(incidentKey);
        }

        clientMulti.exec(function(err, inres){
            //console.log(inres);

            for(let incident of inres){
                let incidentTime = parseInt(incident["timestamp"]);
                let incidentKey = incident["id"];
                let incidentPlayer = incident["player"];

                stats["incidents"][incidentKey] = incident;

                // if(stats["players"][incidentPlayer] === undefined){
                //
                //
                // }

                if(incidentTime >= startTime - 60){
                    stats["compilation"]["1"].push(incidentKey);
                    stats["players"][incidentPlayer]["1"].push(incidentKey);
                    stats["players"][incidentPlayer]["hasIncident"] = true;
                }
                if(incidentTime >= startTime - 300){
                    stats["compilation"]["5"].push(incidentKey);
                    stats["players"][incidentPlayer]["5"].push(incidentKey);
                    stats["players"][incidentPlayer]["hasIncident"] = true;
                }
                if(incidentTime >= startTime - 600){
                    stats["compilation"]["10"].push(incidentKey);
                    stats["players"][incidentPlayer]["10"].push(incidentKey);
                    stats["players"][incidentPlayer]["hasIncident"] = true;
                }
                if(incidentTime >= startTime - 1800){
                    stats["compilation"]["30"].push(incidentKey);
                    stats["players"][incidentPlayer]["30"].push(incidentKey);
                    stats["players"][incidentPlayer]["hasIncident"] = true;
                }
            }

            stats["timestamp"] = Math.round(Date.now()/1000)
            gStats = stats;
            //console.log(gStats);

        })
    })
}

let StatsService = {}

StatsService.getStats = function (){
    return gStats;
}

StatsService.startService = function startService(){
    refreshStats();
    setInterval(refreshStats, parseInt(process.env.STATS_UPDATE_FREQ));
}

module.exports = StatsService;