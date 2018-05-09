/**
 *
 * miio adapter
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const miio = require('miio');
var utils =  require(__dirname + '/lib/utils');
const safeJsonStringify = require(__dirname + '/lib/json');
var adapter = new utils.Adapter('miio');

const devProps = {
    "philips.light.ceiling": {
        "power": {
            "name": "Power", 
            "role": "switch", 
            "type": "boolean", 
            "default": "false", 
            "read": true, 
            "write": true, 
            "action": "power"
        },
        "togglePower": {
            "name": "Toggle", 
            "role": "button", 
            "type": "boolean", 
            "default": "false", 
            "read": false, 
            "write": true, 
            "action": "togglePower"
        },
        "turnOn": {
            "name": "Power On", 
            "role": "button", 
            "type": "boolean", 
            "default": "false", 
            "read": false, 
            "write": true, 
            "action": "turnOn"
        },
        "turnOff": {
            "name": "Power Off", 
            "role": "button", 
            "type": "boolean", 
            "default": "false", 
            "read": false, 
            "write": true, 
            "action": "turnOff"
        },
        "state": {},
        "brightness": {},
        "increaseBrightness": {},
        "decreaseBrightness": {},
        "mode": {}
    }
}

adapter.on('unload', function (callback) {
    try {
        adapter.log.debug('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

adapter.on('objectChange', function (id, obj) {
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
});

adapter.on('stateChange', function (id, state) {
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    if (state && !state.ack) {
        adapter.log.debug('ack is not set!');
    }
});

adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        switch (obj.command) {
            case 'browsing':
                if (obj && obj.message && typeof obj.message == 'object') {
                    browsing(obj.from, obj.command, obj.callback);
                }
                break;
            case 'adddevice':
                if (obj && obj.message && typeof obj.message == 'object') {
                    addDevice(obj.from, obj.command, obj.message, obj.callback);
                }
                break;
            case 'getDevices':
                if (obj && obj.message && typeof obj.message == 'object') {
                    getDevices(obj.from, obj.command, obj.callback);
                }
                break;
            default:
                adapter.log.warn('Unknown message: ' + JSON.stringify(obj));
                break;
        }
    }
    processMessages();
});


function processMessages(ignore) {
    adapter.getMessage(function (err, obj) {
        if (obj) {
            if (!ignore && obj && obj.command == 'send') processMessage(obj.message);
            processMessages();
        }
    });
}


adapter.on('ready', function () {
    main();
});


function main() {
    adapter.subscribeStates('*');
}


function browsing(from, command, callback){
    adapter.log.debug('browsing: ' + JSON.stringify(command));
    // const devices = miio.devices({
    //     cacheTime: 300 // 5 minutes. Default is 1800 seconds (30 minutes)
    // });
      
    // devices.on('available', device => {
    //     if(device.matches('placeholder')) {
    //         // This device is either missing a token or could not be connected to
    //         adapter.log.debug('device available placeholder: ' + JSON.stringify(device));
    //     } else {
    //         // Do something useful with device
    //         adapter.log.debug('device available: ' + JSON.stringify(device));
    //     }
    // });
      
    // devices.on('unavailable', device => {
    //     // Device is no longer available and is destroyed
    //     adapter.log.debug('device unavailable: ' + JSON.stringify(device));
    // });

    const browser = miio.browse({
        cacheTime: 300 // 5 minutes. Default is 1800 seconds (30 minutes)
    });
      
    const devices = {};
    browser.on('available', reg => {
        adapter.log.debug('device available: ' + safeJsonStringify(reg));
        if (!reg.token) {
            //console.log(reg.id, 'hides its token');
            return;
        }
      
        // Directly connect to the device anyways - so use miio.devices() if you just do this
        reg.connect()
            .then(device => {
                devices[reg.id] = device;
      
                // Do something useful with the device
                adapter.log.debug('device connect: ' + safeJsonStringify(device));
            })
            .catch(err => {
                adapter.log.debug('device connect error: ' + safeJsonStringify(err));
            });
    });
      
    browser.on('unavailable', reg => {
        adapter.log.debug('device unavailable: ' + safeJsonStringify(reg));
        
        const device = devices[reg.id];
        if (!device) return;
      
        device.destroy();
        delete devices[reg.id];
    })
}


function addDevice(from, command, message, callback){
    adapter.log.debug('addDevice: ' + JSON.stringify(message));
    if (message.address && message.token) {
        miio.device({
            address: message.address,
            token: message.token,
        }).then(device => {
            let devId = message.address.split('.').join('_');
            adapter.log.debug('connected: '+safeJsonStringify(device));
            updateDev(devId, message.address, device.miioModel, message.address, message.token, function(){
                updateDevStates(devId, device);
                adapter.sendTo(from, command, 'OK!', callback);
            });
        }).catch(err => {
            adapter.log.debug('connected error: ' + safeJsonStringify(err));
            adapter.sendTo(from, command, {error: err}, callback);
        });
    }
}


function updateDev(dev_id, dev_name, dev_type, dev_addr, dev_token, callback) {
    let id = '' + dev_id;
    adapter.setObjectNotExists(id, {
        type: 'device',
        common: {name: dev_name, type: dev_type, address: dev_addr, token: dev_token}
    }, function(){
        adapter.getObject(id, function(err, obj) {
            if (!err && obj) {
                // if repairing 
                adapter.extendObject(id, {
                    type: 'device',
                    common: {name: dev_name, type: dev_type, address: dev_addr, token: dev_token}
                }, callback);
            }
        });
    });
}


function getDevices(from, command, callback){
    adapter.log.debug('getDevices: ' + JSON.stringify(command));
    adapter.getEnums('enum.rooms', function (err, list) {
        var rooms;
        if (!err){
            rooms = list['enum.rooms'];
        }
        adapter.log.debug('getDevices. rooms: ' + JSON.stringify(rooms));    
        adapter.getDevices((err, result) => {
            adapter.log.debug('getDevices: ' + JSON.stringify(result));
            if (result) {
                var devices = [], cnt = 0, len = result.length;
                for (var item in result) {
                    let devInfo = result[item];
                    if (devInfo._id) {
                        var id = devInfo._id.substr(adapter.namespace.length + 1);
                        devInfo.rooms = [];
                        for (var room in rooms) {
                            if (!rooms[room] || !rooms[room].common || !rooms[room].common.members)
                                continue;
                            if (rooms[room].common.members.indexOf(devInfo._id) !== -1) {
                                devInfo.rooms.push(rooms[room].common.name);
                            }
                        }
                        devices.push(devInfo);
                        cnt++;
                        if (cnt == len) {
                            adapter.log.debug('getDevices result: ' + JSON.stringify(devices));
                            adapter.sendTo(from, command, devices, callback);
                        }
                    }
                }
                if (len == 0) {
                    adapter.log.debug('getDevices result: ' + JSON.stringify(devices));
                    adapter.sendTo(from, command, devices, callback);
                }
            }
        });
    });
}


function updateDevStates(devId, device){
    if (device) {
        //let devId = '10_0_0_109';
        if (device.miioModel && devProps.hasOwnProperty(device.miioModel)) {
            let devStates = devProps[device.miioModel];
            for (let key in devStates) {
                if (devStates.hasOwnProperty(key)) {
                    let prop = devStates[key];
                    let conf = {
                        name: prop.name,
                        type: prop.type,
                        role: prop.role,
                        read: prop.read,
                        write: prop.write,
                    };
                    updateState(devId, key, '', conf);
                }
            }
        }
    }
}


function updateState(devId, name, value, common) {
    adapter.getObject(devId, function(err, obj) {
        if (obj) {
            let new_common = {name: name};
            let id = devId + '.' + name;
            if (common != undefined) {
                if (common.name != undefined) {
                    new_common.name = common.name;
                }
                if (common.type != undefined) {
                    new_common.type = common.type;
                }
                if (common.unit != undefined) {
                    new_common.unit = common.unit;
                }
                if (common.states != undefined) {
                    new_common.states = common.states;
                }
                if (common.read != undefined) {
                    new_common.read = common.read;
                }
                if (common.write != undefined) {
                    new_common.write = common.write;
                }
                if (common.role != undefined) {
                    new_common.role = common.role;
                }
            }
            adapter.extendObject(id, {type: 'state', common: new_common});
            adapter.setState(id, value, true);
        } else {
            adapter.log.debug('no device '+devId);
        }
    });
}

// Resolve a device, resolving the token automatically or from storage
// miio.device({
//     address: '10.0.0.109',
//     token: '65a339f2ce193e93b206aed80b03bde9',
// }).then(device => {
//     adapter.log.debug('connected: '+safeJsonStringify(device));
//     //device.call('set_mode', ['set_bright', 100])
//     //device.call('set_mode', ['set_power', 'on'])
//     // device.call('set_mode', ['set_bright', 100])
//     //     .then(on => adapter.log.debug('Power is now' + safeJsonStringify(on)))
//     //     .catch(err =>adapter.log.debug('toggle error: ' + safeJsonStringify(err)));
// }).catch(err => {
//     adapter.log.debug('connected error: ' + safeJsonStringify(err));
// });