'use strict';
// http://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:dehumidifier:0000A02D:nwt-330ef:1

var Service, Characteristic;
var MIoTDevice = require('./MIoTDehumidifier');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("@sll1001/homebridge-plugin-xiaomi-dmaker-22l", "MijiaDehumidifier", Dehumidifier);
}

function Dehumidifier(log, config) {
    var that = this;
    this.log = log;
    this.services = [];
    this.did = config['did'];
    this.enableLED = config['enableLED'];
    this.enableBuzzer = config['enableBuzzer'];
    this.polling_interval = config['polling_interval'];
    this.max_humidity = config['max_humidity'];
    this.min_humidity = config['min_humidity'];

    this.device = new MIoTDevice(config['did'], config['token'], config['ip']);


    this.device.onChange('switch_status', value => {
        that.updateActive();
        that.updateStatusActive();
        that.updateCurrentHumidifierDehumidifierState();
    });

    this.device.onChange('mode', value => {
        that.updateTargetHumidifierDehumidifierState();
        that.updateRotationSpeed()
    });

    this.device.onChange('relative_humidity', value => {
        that.updateHumidity();
    });

    this.device.onChange('target_humidity', value => {
        that.updateRelativeHumidityDehumidifierThreshold();
    });

    this.device.onChange('physical_control_locked', value => {
        that.updateLockPhysicalControls();
    });


    if (this.enableLED) {
        this.device.onChange('indicator_light', value => {
            that.updateLED();
        });
    }

    if (this.enableBuzzer) {
        this.device.onChange('alarm', value => {
            that.updateBuzzer();
        });
    }

    this.device.onChange('device_fault', value => {
        that.updateWaterTank();
    });
    

    setInterval(function () {
        try {
            that.log('Polling properties every ' + that.polling_interval + ' milliseconds');
            that.device.pollProperties();
        } catch (e) {
            that.log(e);
        }
    }, that.polling_interval);
}

Dehumidifier.prototype.getServices = function () {
    // Accessory Information Service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
        .setCharacteristic(Characteristic.Model, 'dmaker.derh.22l')
        .setCharacteristic(Characteristic.SerialNumber, this.did)
        .setCharacteristic(Characteristic.FirmwareRevision, '2.1.8')
        
    // Service
    this.service = new Service.HumidifierDehumidifier(this.name);

    this.service
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getHumidity.bind(this));

    this.service
        .getCharacteristic(Characteristic.Active)
        .on('get', this.getActive.bind(this))
        .on('set', this.setActive.bind(this));

    this.service
        .getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
        .on('get', this.getCurrentHumidifierDehumidifierState.bind(this));

    this.service
        .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
        .on('get', this.getTargetHumidifierDehumidifierState.bind(this))
        .on('set', this.setTargetHumidifierDehumidifierState.bind(this))
        .setProps({
            validValues: [0, 2]
        });

    this.service
        .getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold)
        .on('get', this.getRelativeHumidityDehumidifierThreshold.bind(this))
        .on('set', this.setRelativeHumidityDehumidifierThreshold.bind(this))
        .setProps({
            minValue: 30,
            maxValue: 70,
            minStep: 5,
        })

    this.service
        .getCharacteristic(Characteristic.LockPhysicalControls)
        .on('get', this.getLockPhysicalControls.bind(this))
        .on('set', this.setLockPhysicalControls.bind(this));


    this.service
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('get', this.getRotationSpeed.bind(this))
        .on('set', this.setRotationSpeed.bind(this))
        .setProps({
            minValue: 33,
            maxValue: 99,
            minStep: 33,
        });


    // Water Tank Sensor
    this.waterTankService = new Service.OccupancySensor('Water Tank');

    this.waterTankService
        .getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));
    this.waterTankService
        .getCharacteristic(Characteristic.OccupancyDetected)
        .on('get', this.getWaterTank.bind(this));


    // Publish Services
    this.services.push(this.informationService);
    this.services.push(this.service);
    this.services.push(this.waterTankService);

    return this.services;
}

Dehumidifier.prototype.getActive = function (callback) {
    this.log('getActive');

    try {
        var value = this.device.get('switch_status');

        if (value == true) {
            return callback(null, Characteristic.Active.ACTIVE);
        } else {
            return callback(null, Characteristic.Active.INACTIVE);
        }
    } catch (e) {
        this.log('getActive Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.setActive = function (targetState, callback, context) {
    this.log('setActive ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == Characteristic.Active.ACTIVE) {
            this.device.set('switch_status', true);
        } else {
            this.device.set('switch_status', false);
        }

        callback();
    } catch (e) {
        this.log('setActive Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateActive = function () {

    try {
        var value = this.device.get('switch_status');
        var targetValue = value ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;

        this.service
            .getCharacteristic(Characteristic.Active)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

        this.log('updateActive to ' + value);
    } catch (e) {
        this.log('updateActive Failed: ' + e);
    }
}

Dehumidifier.prototype.getCurrentHumidifierDehumidifierState = function (callback) {
    this.log('getCurrentHumidifierDehumidifierState');

    try {
        var value = this.device.get('switch_status');

        if (value == true) {
            return callback(null, Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING);
        } else {
            return callback(null, Characteristic.CurrentHumidifierDehumidifierState.INACTIVE);
        }
    } catch (e) {
        this.log('getCurrentHumidifierDehumidifierState Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateCurrentHumidifierDehumidifierState = function () {

    try {
        var value = this.device.get('switch_status');

        var targetValue = value ? Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING : Characteristic.CurrentHumidifierDehumidifierState.INACTIVE;

        this.service.setCharacteristic(Characteristic.CurrentHumidifierDehumidifierState, targetValue);

        this.log('updateCurrentHumidifierDehumidifierState to ' + value);

    } catch (e) {
        this.log('updateCurrentHumidifierDehumidifierState Failed: ' + e);
    }

}

Dehumidifier.prototype.getTargetHumidifierDehumidifierState = function (callback) {
    this.log('getTargetHumidifierDehumidifierState');

    try {

        // 1 (Auto), 2 (Continue), 3 (Dry Clothes)
        // var value = this.device.get('mode');

        // if (value == 0) { // target_humidity
        //     callback(null, Characteristic.TargetHumidifierDehumidifierState.AUTO);
        // } else if (value == 1) { // continuous
        //     callback(null, Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER);
        // } else if (value == 2) { // dry clothes
        //     callback(null, Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER);
        // }
        callback(null, Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER);
    } catch (e) {
        this.log('getCurrentHumidifierDehumidifierState Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.setTargetHumidifierDehumidifierState = function (targetState, callback, context) {
    this.log('setTargetHumidifierDehumidifierState ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {

        // 1 (Auto), 2 (Continue), 3 (Dry Clothes)
        // var mode;

        // switch (targetState) {
        //     case 0: // auto                     
        //         mode = 0
        //         break;
        //     case 2: // dehumidifying
        //         mode = 1
        //         break;
        //     default: // not sure if any other values could be passed here, set to dry mode
        //         mode = 2
        // }

        // this.device.set('mode', mode);

        callback();
    } catch (e) {
        this.log('setTargetHumidifierDehumidifierState Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateTargetHumidifierDehumidifierState = function () {

    try {

        // 1 (Auto), 2 (Continue), 3 (Dry Clothes)
        // var value = this.device.get('mode');
        // var targetValue;

        // if (value == 0) { // target_humidity
        //     var targetValue = Characteristic.TargetHumidifierDehumidifierState.AUTO;
        // } else if (value == 1) { // continuous
        //     var targetValue = Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER;
        // } else if (value == 2) { // dry clothes
        //     var targetValue = Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER;
        // }

        var targetValue = Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER;
        this.service
            .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

        this.log('updateTargetHumidifierDehumidifierState to ' + value);
    } catch (e) {
        this.log('updateTargetHumidifierDehumidifierState Failed: ' + e);
    }
}

Dehumidifier.prototype.getRelativeHumidityDehumidifierThreshold = function (callback) {
    this.log('getRelativeHumidityDehumidifierThreshold');

    try {
        var value = this.device.get('target_humidity');
        callback(null, value);
    } catch (e) {
        this.log('getRelativeHumidityDehumidifierThreshold Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.setRelativeHumidityDehumidifierThreshold = function (targetState, callback, context) {

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {

        if (targetState > this.max_humidity) {
            this.device.set('target_humidity', this.max_humidity);
            this.log('setRelativeHumidityDehumidifierThreshold ' + this.max_humidity + ' ' + context);
        }
        else if (targetState < this.min_humidity) {
            this.device.set('target_humidity', this.min_humidity);
            this.log('setRelativeHumidityDehumidifierThreshold ' + this.min_humidity + ' ' + context);
        }
        else {
            this.device.set('target_humidity', targetState);
            this.log('setRelativeHumidityDehumidifierThreshold ' + targetState + ' ' + context);
        }

        callback();
    } catch (e) {
        this.log('setRelativeHumidityDehumidifierThreshold Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateRelativeHumidityDehumidifierThreshold = function () {

    try {
        var value = this.device.get('target_humidity');

        this.service
            .getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold)
            .setValue(value, undefined, 'fromOutsideHomekit');

        this.log('updateRelativeHumidityDehumidifierThreshold to ' + value);
    } catch (e) {
        this.log('updateRelativeHumidityDehumidifierThreshold Failed: ' + e);
    }
}

Dehumidifier.prototype.getRotationSpeed = function (callback) {
    this.log('getRotationSpeed');

    try {
        var value = this.device.get('mode');
        var speed = 99;
        if (value == 0) {
            speed = 66;
        } else if (value == 1) {
            speed = 33;
        }
        callback(null, speed);
    } catch (e) {
        this.log('getRotationSpeed Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.setRotationSpeed = function (targetState, callback, context) {

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        var modev = 1;
        if (targetState > 66) {
            modev = 2;
        } else if (targetState > 33 ) {
            modev = 0
        }
        this.device.set('mode',modev)
        this.log('setRotationSpeed: ' + targetState + 'to mode ' + modev)
        callback();
    } catch (e) {
        this.log('setRotationSpeed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateRotationSpeed = function () {

    try {
        var value = this.device.get('mode');
        var speed = 99;
        if (value == 0) {
            speed = 66;
        } else if (value == 1) {
            speed = 33;
        }
        this.service
            .getCharacteristic(Characteristic.RotationSpeed)
            .setValue(speed, undefined, 'fromOutsideHomekit');

        this.log('updateRotationSpeed to ' + speed);
    } catch (e) {
        this.log('updateRotationSpeed: ' + e);
    }
}

Dehumidifier.prototype.getLockPhysicalControls = function (callback) {
    this.log('getLockPhysicalControls');

    try {
        var value = this.device.get('physical_control_locked');

        if (value == true) {
            return callback(null, Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED);
        } else {
            return callback(null, Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
        }
    } catch (e) {
        this.log('getLockPhysicalControls Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.setLockPhysicalControls = function (targetState, callback, context) {
    this.log('setLockPhysicalControls ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED) {
            this.device.set('physical_control_locked', true);
        } else {
            this.device.set('physical_control_locked', false);
        }

        callback();
    } catch (e) {
        this.log('setLockPhysicalControls Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateLockPhysicalControls = function () {

    try {
        var value = this.device.get('physical_control_locked');

        var targetValue = value ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;

        this.service
            .getCharacteristic(Characteristic.LockPhysicalControls)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

        this.log('updateLockPhysicalControls to ' + value);
    } catch (e) {
        this.log('updateLockPhysicalControls Failed: ' + e);
    }
}

Dehumidifier.prototype.getStatusActive = function (callback) {
    this.log('getStatusActive');

    try {
        var value = this.device.get('switch_status');
        return callback(null, value);

    } catch (e) {
        this.log('getStatusActive Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateStatusActive = function () {

    try {
        var value = this.device.get('switch_status');

        if (value == true) {
            this.waterTankService.setCharacteristic(Characteristic.StatusActive, true);
        } else {
            this.waterTankService.setCharacteristic(Characteristic.StatusActive, true);
        }

        this.log('updateStatusActive to ' + value);

    } catch (e) {
        this.log('updateStatusActive Failed: ' + e);
    }
}


Dehumidifier.prototype.getHumidity = function (callback) {
    this.log("getHumidity");

    try {
        var value = this.device.get('relative_humidity');

        return callback(null, value);
    } catch (e) {
        this.log('getHumidity Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateHumidity = function () {

    try {
        var value = this.device.get('relative_humidity');
        // do nothing
        this.log('updateHumidity to ' + value);
    } catch (e) {
        this.log('updateHumidity Failed: ' + e);
    }
}

Dehumidifier.prototype.getWaterTank = function (callback) {
    this.log("getWaterTank");

    try {
        var value = this.device.get('device_fault');
        var full = false;
        if (value == 1) {
            full = true;
        }
        return callback(null,full);
    } catch (e) {
        this.log('getWaterTank Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateWaterTank = function () {
    try {
        var value = this.device.get('device_fault');
        var full = false;
        if (value == 1) {
            full = true;
        }
        this.waterTankService.setCharacteristic(Characteristic.OccupancyDetected, full);

        this.log('updateWaterTank to ' + full);
    } catch (e) {
        this.log('updateWaterTank Failed: ' + e);
    }
}

Dehumidifier.prototype.getLED = function (callback) {
    this.log('getLED');

    try {
        var value = this.device.get('indicator_light');

        return callback(null, value);

    } catch (e) {
        this.log('getLED Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.setLED = function (targetState, callback, context) {
    this.log('setLED ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == true) {
            this.device.set('indicator_light', true);
        }
        else {
            this.device.set('indicator_light', false);
        }

        callback();
    } catch (e) {
        this.log('setLED Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateLED = function () {

    try {
        var value = this.device.get('indicator_light');

        this.lightService
            .getCharacteristic(Characteristic.On)
            .setValue(value, undefined, 'fromOutsideHomekit');

        this.log('updateLED to ' + value);
    } catch (e) {
        this.log('updateLED Failed: ' + e);
    }
}

Dehumidifier.prototype.getBuzzer = function (callback) {
    this.log('getBuzzer');

    try {
        var value = this.device.get('alarm');

        return callback(null, value);

    } catch (e) {
        this.log('getBuzzer Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.setBuzzer = function (targetState, callback, context) {
    this.log('setBuzzer ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == true) {
            this.device.set('alarm', true);
        }
        else {
            this.device.set('alarm', false);
        }

        callback();
    } catch (e) {
        this.log('setBuzzer Failed: ' + e);
        callback(e);
    }
}

Dehumidifier.prototype.updateBuzzer = function () {

    try {
        var value = this.device.get('alarm');

        this.buzzerService
            .getCharacteristic(Characteristic.On)
            .setValue(value, undefined, 'fromOutsideHomekit');

        this.log('updateBuzzer to ' + value);
    } catch (e) {
        this.log('updateBuzzer Failed: ' + e);
    }
}
