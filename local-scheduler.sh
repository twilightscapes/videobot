#!/bin/bash

# Local automation script for Bluesky bot
# Run this with: nohup ./local-scheduler.sh &

while true; do
    echo "$(date): Triggering bot function..."
    curl -X GET "https://bot.videoprivacy.org/.netlify/functions/bot" -s
    echo "$(date): First check completed"
    
    sleep 30
    
    echo "$(date): Triggering bot function (second check)..."
    curl -X GET "https://bot.videoprivacy.org/.netlify/functions/bot" -s  
    echo "$(date): Second check completed"
    
    sleep 30
done
