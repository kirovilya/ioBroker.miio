/**
 *
 * miio adapter
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

var utils =  require(__dirname + '/lib/utils');
const miio = require('miio');
var adapter = new utils.Adapter('miio');

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

    // const browser = miio.browse({
    //     cacheTime: 300 // 5 minutes. Default is 1800 seconds (30 minutes)
    // });
      
    // const devices = {};
    // browser.on('available', reg => {
    //     adapter.log.debug('device available: ' + JSON.stringify(reg));
    //     if (!reg.token) {
    //         //console.log(reg.id, 'hides its token');
    //         return;
    //     }
      
    //     // Directly connect to the device anyways - so use miio.devices() if you just do this
    //     reg.connect()
    //         .then(device => {
    //             devices[reg.id] = device;
      
    //             // Do something useful with the device
    //             adapter.log.debug('device connect: ' + JSON.stringify(device));
    //         })
    //         .catch(err => {
    //             adapter.log.debug('device connect error: ' + JSON.stringify(err));
    //         });
    // });
      
    // browser.on('unavailable', reg => {
    //     adapter.log.debug('device unavailable: ' + JSON.stringify(reg));
        
    //     const device = devices[reg.id];
    //     if (!device) return;
      
    //     device.destroy();
    //     delete devices[reg.id];
    // })

    // Resolve a device, resolving the token automatically or from storage
    miio.device({ address: '10.0.0.109' })
        .then(device => adapter.log.debug('connected: ' + JSON.stringify(device)))
        .catch(err => adapter.log.debug('connected error: ' + JSON.stringify(err)));

    // // Resolve a device, specifying the token (see below for how to get the token)
    // miio.device({ address: '192.168.100.8', token: 'token-as-hex' })
    //     .then(device => console.log('Connected to', device))
    //     .catch(err => handleErrorHere);
}