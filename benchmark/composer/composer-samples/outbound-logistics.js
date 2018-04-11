/*
*  Basic Sample Network
*  Updates the value of an Asset through a Transaction.
*  - Example test round (txn <= testAssets)
*      {
*        "label" : "basic-sample-network",
*        "txNumber" : [50],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "arguments": {"testAssets": 50},
*        "callback" : "benchmark/composer/composer-samples/basic-sample-network.js"
*      }
*  - Init: 
*    - Single Participant created (PARTICIPANT_0)
*    - Test specified number of Assets created, belonging to a PARTICIPANT_0
*  - Run:
*    - Transactions run against all created assets to update their values
*
*/

'use strict'
module.exports.info = "Basic Sample Network Performance Test";

const composerUtils = require('../../../src/composer/composer_utils');

const namespace = 'outbound.logistics';
const busNetName = 'outbound-logistics';

var bc;                 // The blockchain main (Composer)
var busNetConnections;  // Global map of all business network connections to be used
var testAssetNum;       // Number of test assets to create
var factory;            // Global Factory
var counter = 0;

module.exports.init = async function (blockchain, context, args) {
    // Create Participants and Assets to use in main test    
    bc = blockchain;
    busNetConnections = new Map();
    busNetConnections.set('admin', context);

    try {
        factory = busNetConnections.get('admin').getBusinessNetwork().getFactory();
        let participantRegistry = await busNetConnections.get('admin').getParticipantRegistry(namespace + '.participant.Manufacturer');
        let manufacturerExists = await participantRegistry.exists('Nissan');

        if (!manufacturerExists) {
            // Create & add participant
            let participant = factory.newResource(namespace + '.participant', 'Manufacturer', 'Nissan');
            participant.manufacturerName = 'Nissan';
            await participantRegistry.add(participant);

        }

        let plantRegistry = await busNetConnections.get('admin').getParticipantRegistry(namespace + '.participant.Plant');
        let plantExists = await plantRegistry.exists('NMUK');

        if (!plantExists) {
            let plant = factory.newResource(namespace + '.participant', 'Plant', 'NMUK');
            plant.owner = factory.newRelationship('outbound.logistics.participant', "Manufacturer", "Nissan");
            plant.description = "Nissan Manufacturing United Kingdom";
            await plantRegistry.add(plant);

            let plantUsername = 'NMUK';
            let newPlantConnection = await composerUtils.obtainConnectionForParticipant(busNetConnections.get('admin'), busNetName, plant, plantUsername);
            busNetConnections.set(plantUsername, newPlantConnection);
        }




    } catch (error) {
        console.log('error in test init: ', error);
        return Promise.reject(error);
    }
}

module.exports.run = function () {
    let transaction = factory.newTransaction(namespace + '.vehicle', 'ManufactureCar');
    transaction.vin = 'CAR' + counter;
    counter++;
    transaction.brand = "Nissan";
    transaction.model = "QashQai";
    transaction.manufacturedDate = new Date();
    transaction.manufacturingPlant = factory.newRelationship(namespace + '.participant', 'Plant', 'NMUK');

    //console.log(transaction)
    return bc.bcObj.submitTransaction(busNetConnections.get('NMUK'), transaction);
}

module.exports.end = function (results) {
    return Promise.resolve(true);
};