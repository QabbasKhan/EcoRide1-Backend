require('dotenv').config();
const mqtt = require('mqtt');
// MQTT Client Setup
const brokerUrl = 'mqtt://broker.hivemq.com:1883';
const mqttClient = mqtt.connect(brokerUrl); // Update with your broker's URL
mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker2');
});

module.exports =  mqttClient ;