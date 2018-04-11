'use strict';

/**
 * Manufacture a car
 * @param {outbound.logistics.vehicle.ManufactureCar} carData
 * @transaction
 */
function onCarManufactured(carData) {

    var factory = getFactory();

    var car = factory.newResource('outbound.logistics.vehicle', 'Car', carData.vin);
    car.brand = carData.brand;
    car.model = carData.model;
    car.manufacturedDate = carData.manufacturedDate;
    car.manufacturingPlant = carData.manufacturingPlant;

    if (carData.doors) {
        car.doors = carData.doors;
    }
    if (carData.boot) {
        car.boot = carData.boot;
    }

    return getAssetRegistry('outbound.logistics.vehicle.Car').then(function (carRegistry) {
        return carRegistry.add(car);
    });
    // CREATE NEW EVENT: CarCreated
}

/**
 * Assign a Transport Plan to a vehicle.
 * Assigning a transport plan is only available to logistics teams.
 * @param {outbound.logistics.vehicle.AssignTransportPlan} transportPlanData
 * @transaction
 */
function onTransportPlanAssignment(transportPlanData) {

    var factory = getFactory();

    return getAssetRegistry('outbound.logistics.vehicle.Car').then(function (carRegistry) {
        return carRegistry.exists(transportPlanData.vin).then(function (exists) {
            if (exists) {
                return carRegistry.get(transportPlanData.vin).then(function (car) {
                    car.transportPlan = transportPlanData.transportPlan;
                    return carRegistry.update(car);
                });
            }
        });
    });
}

/**
 * Fullfil a transport movement of a vehicle as per a contract.
 * @param {outbound.logistics.vehicle.TransportVehicleFulfilled} transportContractId
 * @transaction
 */
function onTransportVehicleFulfilled(transportContractId) {
    
}

/**
 * Manufacturer creates a plant
 * @param {outbound.logistics.participant.CreatePlant} plantData
 * @transaction
 */
function createPlant(plantData) {

    return getParticipantRegistry('outbound.logistics.participant.Plant').then(function (plantRegistry) {
        var factory = getFactory();

        var plant = factory.newResource('outbound.logistics.participant', 'Plant', plantData.plantId);
        plant.owner = plantData.owner;

        return plantRegistry.add(plant);
    });
    // CREATE NEW EVENT: PlantCreated
}

/**
 * Begin an auction
 * @param {outbound.logistics.auction.StartAuction} initialAuctionData
 * @transaction
 */
function onStartAuction(initialAuctionData) {

    var factory = getFactory();

    var transportContractAuction = factory.newResource('outbound.logistics.auction', 'TransportContractAuction', initialAuctionData.auctionId);
    transportContractAuction.route = initialAuctionData.route;
    transportContractAuction.minimumBid = initialAuctionData.minimumBid;
    transportContractAuction.expectedDeliveryDate = initialAuctionData.expectedDeliveryDate;
    transportContractAuction.vehicle = initialAuctionData.vehicle;
    transportContractAuction.managingLogisticsTeam = initialAuctionData.managingLogisticsTeam;

    return getAssetRegistry('outbound.logistics.auction.TransportContractAuction').then(function (transportContractAuctionRegistry) {
        return transportContractAuctionRegistry.add(transportContractAuction);
    });
}

/**
 * Deal with a new bid
 * @param {outbound.logistics.auction.Bid} bid
 * @transaction
 */
function onIncomingBid(bid) {

    var factory = getFactory();

    var newBidEvent = factory.newEvent('outbound.logistics.auction', 'NewBid')
    newBidEvent.bidValue = bid.bidValue;
    newBidEvent.auction = bid.auction;
    newBidEvent.bidder = bid.bidder;
    emit(newBidEvent);
}

/**
 * Update the auction so that it has ended.
 * Create a transport contract for the winning bidder and associate it with the correct route.
 * Update the car's transport plan so it has a contract associated with it.
 * @param {outbound.logistics.auction.EndAuction} endAuction
 * @transaction
 */
function onEndAuction(endAuction) {

    return getAssetRegistry('outbound.logistics.auction.TransportContractAuction').then(function (transportContractAuctionRegistry) {
        return transportContractAuctionRegistry.get(endAuction.auction.transportContractAuctionId).then(function (auction) {
            auction.auctionComplete = true;
            auction.endDate = endAuction.timestamp;
            return transportContractAuctionRegistry.update(auction);
        });
    }).then(function () {
        var factory = getFactory();
        var transportContract = factory.newResource('outbound.logistics.auction', 'TransportContract', endAuction.contractIdToCreate);
        return query('AllBidsOnAuction', { auction: 'resource:outbound.logistics.auction.TransportContractAuction#' + endAuction.auction.transportContractAuctionId }).then(function (bids) {
            var topBid = bids[0];
            bids.forEach(function (bid) {
                if (bid.bidValue > topBid.bidValue) {
                    topBid = bid;
                }
            });
            return topBid;
        }).then(function (topBid) {
            transportContract.transportContractId = endAuction.contractIdToCreate;
            transportContract.creationDate = endAuction.timestamp;
            transportContract.paymentAmount = topBid.bidValue;
            transportContract.route = endAuction.auction.route;
            transportContract.vehicle = endAuction.auction.vehicle;
            transportContract.managingLogisticsTeam = endAuction.auction.managingLogisticsTeam;
            transportContract.transportationCompany = topBid.bidder;

            return getAssetRegistry('outbound.logistics.auction.TransportContract').then(function (transportContractRegistry) {
                return transportContractRegistry.add(transportContract);
            });
        }).then(function () {
            return getAssetRegistry('outbound.logistics.vehicle.Car').then(function (carRegistry) {
                return carRegistry.get(endAuction.auction.vehicle.vin).then(function (vehicle) {

                    vehicle.transportPlan.routes.forEach(function (route, index) {
                        if (route.routeId === endAuction.auction.route.routeId) {
                            vehicle.transportPlan.routes[index].associatedContract = transportContract;

                            return carRegistry.update(vehicle);
                        }
                    });

                });
            });
        });
    });
}
