//@Created By Pierre Gode
const axios = require("axios");
require('dotenv').config();
const config = require('./config');

// Get configuration from environment variables
const USERNAME = process.env.ZAPTEC_USERNAME;
const PASSWORD = process.env.ZAPTEC_PASSWORD;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;
const COMPANY_NAME = process.env.COMPANY_NAME;

let bearerToken;
let previousChargerStatuses = {};
let previousChargeHistory = []; 
let previousFreeChargerCount = 0;
let initialRun = true;
function logWithTimestamp(message) {
    const timeDate = new Date(new Date().toLocaleString('en-US', { timeZone: config.timeZone }));
    const hours = String(timeDate.getHours()).padStart(2, '0');
    const minutes = String(timeDate.getMinutes()).padStart(2, '0');
    const timestamp = `${hours}:${minutes}`;
    console.log(`[${timestamp}] ${message}`);
}

async function refreshBearerToken() {
    logWithTimestamp("Attempting to refresh Zaptec bearer token...");
    const encodedCredentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

    try {
        const response = await axios.post("https://api.zaptec.com/oauth/token",
            `grant_type=password&username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}`, {
                headers: {
                    "accept": "application/json",
                    "content-type": "application/x-www-form-urlencoded",
                    "Authorization": `Basic ${encodedCredentials}`
                }
            }
        );

        bearerToken = response.data.access_token;
        logWithTimestamp("Successfully refreshed Zaptec bearer token.");
    } catch (error) {
        console.error("Failed to refresh Zaptec token:", error);
    }
}

async function checkChargerAvailability() {
    logWithTimestamp("Checking charger availability...");

    const statusIconsCircles = {
        1: "🟢", // charger free to use
        2: "🟠", // charger authorizing
        3: "🟡", // charger in use, charging
        5: "🔴" // charge complete
    };

    const statusIconsSlack = {
        1: ":z-free:",
        2: ":z-auth:",
        3: ":z-chrg:",
        5: ":z-full:"
    };

    const statusIconsEmoji = {
        1: "🔌", // charger free to use
        2: "🔐", // charger authorizing
        3: "🪫", // charger in use, charging
        5: "🔋" // charge complete
    };

    if (config.iconSet == 1)
        statusIcons = statusIconsCircles;
    else if (config.iconSet == 2)
        statusIcons = statusIconsEmoji;
    else 
        statusIcons = statusIconsSlack;

    let availableChargers = [];
    let completedChargers = [];
    let allChargerStatuses = "";
    let freeChargersCount = 0;
    let chargingStatusChanged = false;

    try {
        const response = await axios.get("https://api.zaptec.com/api/chargers", {
            headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "accept": "text/plain"
            }
        });

        const chargers = response.data.Data;
        logWithTimestamp(`Found ${chargers.length} chargers.`);

    for (let charger of chargers) {
        const chargerName = charger.Name.replace(` ${COMPANY_NAME}`, "");
        const previousStatus = previousChargerStatuses[charger.Id];

        allChargerStatuses += `${statusIcons[charger.OperatingMode]} `;

        if (previousStatus !== charger.OperatingMode) {
            if (charger.OperatingMode == 1) {
                freeChargersCount++;
                availableChargers.push(chargerName);
            } else if (charger.OperatingMode == 2) { 
            } else if (charger.OperatingMode == 5) {
                completedChargers.push(chargerName);
            } else if (charger.OperatingMode == 3) {
                chargingStatusChanged = true;
            }

            previousChargerStatuses[charger.Id] = charger.OperatingMode;
        } else if (charger.OperatingMode == 1) {
            freeChargersCount++;
        }
    }

        if (chargingStatusChanged && previousFreeChargerCount > freeChargersCount) {
            let summaryMessage = freeChargersCount === 0 ? "❌ 0 chargers available" : `${statusIcons[1]} ${freeChargersCount} charger(s) available.`;
            console.log(summaryMessage + "\n\n" + allChargerStatuses);
            await notifyTeams(summaryMessage + "\n\n" + allChargerStatuses).catch(err => console.error("Failed to send Teams notification:", err));
        }

        if (!initialRun) {
            if (availableChargers.length) {
                const verb = availableChargers.length === 1 ? "is" : "are";
                const message = `${statusIcons[1]} ${availableChargers.join(", ")} ${verb} available!`;
                console.log(message);
                await notifyTeams(message + "\n\n" + allChargerStatuses).catch(err => console.error("Failed to send Teams notification:", err));
            }

            if (completedChargers.length) {
                const verb = completedChargers.length === 1 ? "has" : "have";
                const message = `${statusIcons[5]} ${completedChargers.join(", ")} ${verb} stopped charging.`;
                console.log(message);
                await notifyTeams(message + "\n\n" + allChargerStatuses).catch(err => console.error("Failed to send Teams notification:", err));
            }
        }
        initialRun = false;  // Reset the flag after the initial run

        previousFreeChargerCount = freeChargersCount;

    } catch (error) {
        console.error("Failed to fetch charger data:", error);
    }
}


let lastChargeDate;  // Add this line at the top of your script, outside any function.

async function getChargeHistory() {
    logWithTimestamp("Fetching charge history...");

    try {
        const response = await axios.get("https://api.zaptec.com/api/chargehistory", {
            headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "accept": "application/json"
            }
        });

        const currentChargeHistory = response.data.Data;  

        // If this is the initial run or the charge history has changed since the last run
        if (!lastChargeDate || (lastChargeDate && lastChargeDate !== currentChargeHistory[0].StartDateTime)) {

            // Update the last charge date
            lastChargeDate = currentChargeHistory[0].StartDateTime;

            let historyEntries = Math.min(currentChargeHistory.length, 1);
            for (let i = 0; i < historyEntries; i++) {
                const charge = currentChargeHistory[i];

                // Convert StartDateTime to a JavaScript Date object and adjust for timezone difference
                var startDate = new Date(charge.StartDateTime);
                startDate.setHours(startDate.getHours() + 2);

                // Convert EndDateTime to a JavaScript Date object and adjust for timezone difference
                var endDate = new Date(charge.EndDateTime);
                endDate.setHours(endDate.getHours() + 2);

                // Format the start date and time using 24-hour format
                const formattedStartDate = new Intl.DateTimeFormat(undefined, {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).format(startDate);

                // Format the end date and time using 24-hour format
                const formattedEndDate = new Intl.DateTimeFormat(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).format(endDate);

                // Log the formatted start and end date and time, and the energy consumed
                logWithTimestamp(`${formattedStartDate} - ${formattedEndDate}: ${charge.Energy} kWh`);
                const message = `${formattedStartDate} - ${formattedEndDate}: ${charge.Energy} kWh`;

                if (config.showChargingdata) {
                    await notifyTeams("Your charging session is complete:"  + "\n" + message + "\n\n")
                    .catch(err => console.error("Failed to send Teams notification:", err));
                }
            }
        }

        previousChargeHistory = currentChargeHistory; // Update the previous charge history
        logWithTimestamp(`Fetched charge history for ${currentChargeHistory.length} entries.`);

    } catch (error) {
        console.error("Failed to fetch charge history:", error);
    }
}



async function notifyTeams(message) {
    
    const currentHour = new Date().getHours();
    const currentDay = new Date().toLocaleString('en-us', { weekday: 'long' });

    logWithTimestamp(`Attempting to notify Teams. Current time: ${new Date().toLocaleTimeString()} and current day: ${currentDay}`);

    if (currentHour >= config.startSilentHour || currentHour < config.endSilentHour || config.silentDays.includes(currentDay)) {
        logWithTimestamp(`Skipped Teams notification due to current time or day restrictions. Silent hours: ${config.startSilentHour}:00 - ${config.endSilentHour}:00, Silent days: ${config.silentDays.join(", ")}`);
        return;
    }

    const payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": "Charger Status Update",
        "sections": [{
            "activityTitle": "Charger Status Update",
            "text": message
        }]
    };

    try {
        await axios.post(TEAMS_WEBHOOK_URL, payload);
        logWithTimestamp("Sent Teams notification:", message);
    } catch (error) {
        console.error("Failed to send Teams notification:", error);
    }
}

(async () => {
    await refreshBearerToken().catch(err => console.error("Initial token refresh failed:", err));
    await checkChargerAvailability().catch(err => console.error("Initial charger check failed:", err));

    setInterval(async () => {
        await checkChargerAvailability().catch(err => console.error("Periodic charger check failed:", err));
    }, 300000);

    setInterval(async () => {
        await refreshBearerToken().catch(err => console.error("Periodic Zaptec token refresh failed:", err));
    }, 86400000);

    logWithTimestamp("Zaptec Teams Notifier is now running!");
})();

module.exports = {
    refreshBearerToken,
    checkChargerAvailability,
    getChargeHistory
};
//@Created By Pierre Gode
