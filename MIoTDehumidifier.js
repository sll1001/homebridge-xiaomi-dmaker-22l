var MIoTDevice = require('./MIoTDevice');

class MIoTDehumidifier extends MIoTDevice {
    constructor(did, token, ip) {
        super(did, token, ip);

        this.dmaker_22l = {
            'switch_status': [2, 1],    // bool
            'device_fault' : [2, 2],    // unit8: 0 (No Faults), 1 (Water Full), 2 (Sensor Fault1)
                                        // 3 (Sensor Fault2), 4 (Communication Fault1), 5 (Filter Clean), 6 (Defrost)
                                        // 7 (Fan Motor), 8 (Overload), 9 (Lack of Refrigerant)
            'mode' : [2, 3],            // unit8: 0 (Smart), 1 (Sleep), 2 (Clothes Drying)
            'target_humidity' : [2, 5],  // uint8: min 30 max 70 inc 1
            'relative_humidity' : [3, 1],// uint8: min 0, max 100 inc 1
            'temperature' : [3, 2],     // float: min -30, max 100 inc 0.1
            'alarm' : [3, 4],           // bool
            'indicator_light' : [5, 1], // bool
            'd_mode' : [5, 2],          // unit8: 0 (close), 1 (half), 2 (full)
            'physical_control_locked' : [6, 1], // bool
            // event [7, 1] tank full   
        }
        
        this.dictionary = this.dmaker_22l

        for (var propertyName in this.dictionary) {
            this.trackProperty(this.dictionary[propertyName][0], this.dictionary[propertyName][1]);
        };


    }

    get(propertyName) {
        if (!this.dictionary.hasOwnProperty(propertyName)) {
            throw 'MIoTDevice property \'' + propertyName + '\' is not defined';
        }

        return this.getProperty(this.dictionary[propertyName][0], this.dictionary[propertyName][1]);
    }

    set(propertyName, value) {
        if (!this.dictionary.hasOwnProperty(propertyName)) {
            throw 'MIoTDevice property \'' + propertyName + '\' is not defined';
        }

        this.setProperty(this.dictionary[propertyName][0], this.dictionary[propertyName][1], value);
    }

    onChange(propertyName, callback) {
        if (!this.dictionary.hasOwnProperty(propertyName)) {
            throw 'MIoTDevice property \'' + propertyName + '\' is not defined';
        }

        this.onChangeProperty(this.dictionary[propertyName][0], this.dictionary[propertyName][1], callback);
    }


}

module.exports = MIoTDehumidifier
