"use strict";
exports.__esModule = true;
exports.listCQChannels = exports.listQueuesChannels = exports.listPubSubChannels = exports.deleteChannel = exports.createChannel = void 0;
var pb = require("../protos");
var utils_1 = require("./utils");
function createChannel(client, md, clientId, channelName, channelType) {
    var pbMessage = new pb.Request();
    pbMessage.setRequestid(utils_1.Utils.uuid());
    pbMessage.setClientid(clientId);
    pbMessage.setRequesttypedata(2);
    pbMessage.setChannel('kubemq.cluster.internal.requests');
    pbMessage.setMetadata('create-channel');
    var pbtags = pbMessage.getTagsMap();
    pbtags.set('channel_type', channelType);
    pbtags.set('channel', channelName);
    pbtags.set('client_id', clientId);
    pbMessage.setTimeout(10000);
    return new Promise(function (resolve, reject) {
        client.sendRequest(pbMessage, md, function (e) {
            if (e) {
                reject(e);
                return;
            }
            resolve();
        });
    });
}
exports.createChannel = createChannel;
function deleteChannel(client, md, clientId, channelName, channelType) {
    var pbMessage = new pb.Request();
    pbMessage.setRequestid(utils_1.Utils.uuid());
    pbMessage.setClientid(clientId);
    pbMessage.setRequesttypedata(2);
    pbMessage.setChannel('kubemq.cluster.internal.requests');
    pbMessage.setMetadata('delete-channel');
    var pbtags = pbMessage.getTagsMap();
    pbtags.set('channel_type', channelType);
    pbtags.set('channel', channelName);
    pbtags.set('client_id', clientId);
    pbMessage.setTimeout(10000);
    return new Promise(function (resolve, reject) {
        client.sendRequest(pbMessage, md, function (e) {
            if (e) {
                reject(e);
                return;
            }
            resolve();
        });
    });
}
exports.deleteChannel = deleteChannel;
function listPubSubChannels(client, md, clientId, search, channelType) {
    var pbMessage = new pb.Request();
    pbMessage.setRequestid(utils_1.Utils.uuid());
    pbMessage.setClientid(clientId);
    pbMessage.setRequesttypedata(2);
    pbMessage.setChannel('kubemq.cluster.internal.requests');
    pbMessage.setMetadata('list-channels');
    var pbtags = pbMessage.getTagsMap();
    pbtags.set('client_id', clientId);
    pbtags.set('channel_type', channelType);
    pbtags.set('channel_search', search);
    pbMessage.setTimeout(10000);
    return new Promise(function (resolve, reject) {
        client.sendRequest(pbMessage, md, function (e, data) {
            if (e) {
                reject(e);
                return;
            }
            if (!data) {
                reject(new Error('no data'));
                return;
            }
            if (data.getBody() === null) {
                resolve([]);
                return;
            }
            var channels = decodePubSubChannelList(data.getBody_asU8());
            resolve(channels);
        });
    });
}
exports.listPubSubChannels = listPubSubChannels;
function listQueuesChannels(client, md, clientId, search, channelType) {
    var pbMessage = new pb.Request();
    pbMessage.setRequestid(utils_1.Utils.uuid());
    pbMessage.setClientid(clientId);
    pbMessage.setRequesttypedata(2);
    pbMessage.setChannel('kubemq.cluster.internal.requests');
    pbMessage.setMetadata('list-channels');
    var pbtags = pbMessage.getTagsMap();
    pbtags.set('client_id', clientId);
    pbtags.set('channel_type', channelType);
    pbtags.set('channel_search', search);
    pbMessage.setTimeout(10000);
    return new Promise(function (resolve, reject) {
        client.sendRequest(pbMessage, md, function (e, data) {
            if (e) {
                reject(e);
                return;
            }
            if (!data) {
                reject(new Error('no data'));
                return;
            }
            if (data.getBody() === null) {
                resolve([]);
                return;
            }
            var channels = decodeQueuesChannelList(data.getBody_asU8());
            resolve(channels);
        });
    });
}
exports.listQueuesChannels = listQueuesChannels;
function listCQChannels(client, md, clientId, search, channelType) {
    var pbMessage = new pb.Request();
    pbMessage.setRequestid(utils_1.Utils.uuid());
    pbMessage.setClientid(clientId);
    pbMessage.setRequesttypedata(2);
    pbMessage.setChannel('kubemq.cluster.internal.requests');
    pbMessage.setMetadata('list-channels');
    var pbtags = pbMessage.getTagsMap();
    pbtags.set('client_id', clientId);
    pbtags.set('channel_type', channelType);
    pbtags.set('channel_search', search);
    pbMessage.setTimeout(10000);
    return new Promise(function (resolve, reject) {
        client.sendRequest(pbMessage, md, function (e, data) {
            if (e) {
                reject(e);
                return;
            }
            if (!data) {
                reject(new Error('no data'));
                return;
            }
            if (data.getBody() === null) {
                resolve([]);
                return;
            }
            var channels = decodeCQChannelList(data.getBody_asU8());
            resolve(channels);
        });
    });
}
exports.listCQChannels = listCQChannels;
function decodePubSubChannelList(dataBytes) {
    /**
     * Decodes the given data bytes into a list of PubSubChannel objects.
     *
     * @param dataBytes The data bytes to decode.
     * @returns A list of PubSubChannel objects.
     */
    // Decode bytes to string and parse JSON
    var dataStr = new TextDecoder().decode(dataBytes);
    var channelsData = JSON.parse(dataStr);
    var channels = [];
    for (var _i = 0, channelsData_1 = channelsData; _i < channelsData_1.length; _i++) {
        var item = channelsData_1[_i];
        // Extracting incoming and outgoing as Stats objects
        var incoming = item['incoming'];
        var outgoing = item['outgoing'];
        // Creating a Channel instance with the Stats objects
        var channel = {
            name: item['name'],
            type: item['type'],
            lastActivity: item['lastActivity'],
            isActive: item['isActive'],
            incoming: incoming,
            outgoing: outgoing
        };
        channels.push(channel);
    }
    return channels;
}
function decodeQueuesChannelList(dataBytes) {
    /**
     * Decodes a byte string into a list of QueuesChannel objects.
     *
     * @param dataBytes The byte string to be decoded.
     * @returns A list of QueuesChannel objects.
     *
     * Note:
     * - This method assumes that the byte string is encoded in 'utf-8' format.
     * - The byte string should represent a valid JSON object.
     * - The JSON object should contain the necessary fields ('name', 'type', 'lastActivity', 'isActive', 'incoming', 'outgoing') for creating QueuesChannel objects.
     * - The 'incoming' and 'outgoing' fields should contain valid JSON objects that can be parsed into QueuesStats objects.
     */
    // Decode bytes to string and parse JSON
    var dataStr = new TextDecoder().decode(dataBytes);
    var channelsData = JSON.parse(dataStr);
    var channels = [];
    for (var _i = 0, channelsData_2 = channelsData; _i < channelsData_2.length; _i++) {
        var item = channelsData_2[_i];
        // Extracting incoming and outgoing as Stats objects
        var incoming = item['incoming'];
        var outgoing = item['outgoing'];
        // Creating a Channel instance with the Stats objects
        var channel = {
            name: item['name'],
            type: item['type'],
            lastActivity: item['lastActivity'],
            isActive: item['isActive'],
            incoming: incoming,
            outgoing: outgoing
        };
        channels.push(channel);
    }
    return channels;
}
function decodeCQChannelList(dataBytes) {
    /**
     * Decodes the given byte array into a list of CQChannel objects.
     *
     * @param dataBytes The byte array to decode.
     * @returns The list of CQChannel objects decoded from the byte array.
     */
    // Decode bytes to string and parse JSON
    var dataStr = new TextDecoder().decode(dataBytes);
    var channelsData = JSON.parse(dataStr);
    var channels = [];
    for (var _i = 0, channelsData_3 = channelsData; _i < channelsData_3.length; _i++) {
        var item = channelsData_3[_i];
        // Extracting incoming and outgoing as Stats objects
        var incoming = item['incoming'];
        var outgoing = item['outgoing'];
        // Creating a Channel instance with the Stats objects
        var channel = {
            name: item['name'],
            type: item['type'],
            lastActivity: item['lastActivity'],
            isActive: item['isActive'],
            incoming: incoming,
            outgoing: outgoing
        };
        channels.push(channel);
    }
    return channels;
}
