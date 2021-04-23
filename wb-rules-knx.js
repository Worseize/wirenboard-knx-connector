(function() {
    var knx_vdev_obj = {
        title: "KNX Group Addresses",
        cells: {
            "2-0-1": { // control
                type: "switch",
                value: false
            },
            "2-1-1": { //control fb
                type: "value",
                value: 0
            },
            "3-2-1": {//dim
                type: "range",
              	min:0,
                max: 255,
                value: 0,
                knx_type: "byte"
            },
            "3-3-1": {//dim fb
                type: "range",
              	min:0,
                max: 255,
                value: 0,
                knx_type: "byte",
              	readonly : true
            },
            "8-0-1": {//temp
                type: "temperature",
              	knx_type: "float16",
                value: 11.11
            },
            "8-1-1": {//setpoint
                type: "temperature",
              	knx_type: "float16",
                value: 22
            },
            "8-2-1": {//setpoint fb
                type: "temperature",
              	knx_type: "float16",
                value: 33
            }
        }
    };


    var vdev_when_changed = [];
    var vdev_devid = "knx_group_addrs";

    for (var control_id in knx_vdev_obj.cells) {
        if (knx_vdev_obj.cells.hasOwnProperty(control_id)) {
            vdev_when_changed.push("knx_group_addrs/" + control_id);
        }
    }

    defineVirtualDevice(vdev_devid, knx_vdev_obj);

    defineRule("knx_vdev_feedback", {
        whenChanged: vdev_when_changed,
        then: function(newValue, devName, cellName) {
            var group_address = cellName.split("-").join("/");
            var value = +newValue;
            var write_str = "";
            if (knx_vdev_obj.cells[cellName].knx_type == "byte") {
                while (value > 0) {
                    var rem = value % 256;
                    value = Math.floor(value / 256);
                    write_str = rem + " " + write_str;
                }
                write_str = "0 " +  write_str;
              	dev["knx/data"] = "g:{} GroupValueWrite {}".format(group_address, write_str);
            }else if(knx_vdev_obj.cells[cellName].knx_type == "float16"){
            /*
              	var firstVal = newValue[1] + newValue[2];
              	var secondVal = newValue[3] + newValue[4];
              	runShellCommand('knxtool groupwrite local:/var/run/knx' + cellName + '0x' + firstVal + '0x' + secondVal);
            */
            }else{
              write_str = "" +  value;
              if (write_str) {
                  dev["knx/data"] = "g:{} GroupValueWrite {}".format(group_address, write_str);
              }
            }
        }
    });

    defineRule("knx_vdev_incoming", {
        whenChanged: "knx/data",
        then: function(newValue, devName, cellName) {
            var arr = newValue.split(/\s/);
            var sourceAddr = arr[0].split(/i\:|\,/);
            var groupAddr = arr[1].split(/g\:|\,/);
            var value;
          	if(arr[2] == 'GroupValueWrite'){
              value = newValue.split(/GroupValueWrite/)[1];
              if ((sourceAddr[1] == "0/0/0") || (sourceAddr[1] == "1/1/255")) { // skip local echo
                  return;
              }
              if(value.length >= 8){ //2byte
                  dev[vdev_devid][groupAddr[1].split("/").join("-")] = readKxnBusFloat16(value);
              }else{//1byte and 1 bit
                /* 1 bit rule
                if (parseInt(value, 16)){
                  dev[vdev_devid][groupAddr[1].split("/").join("-")] = true;
                }
                else{
                  dev[vdev_devid][groupAddr[1].split("/").join("-")] = false;
                }
                */
                  dev[vdev_devid][groupAddr[1].split("/").join("-")] = parseInt(value, 16);
              }
            }else if(arr[2] == 'GroupValueRead'){
              value = newValue.split(/GroupValueRead/)[1];
              /* Group Read 
              if ((sourceAddr[1] == "0/0/0") || (sourceAddr[1] == "1/1/255")) { // skip local echo
                  return;
              }
              if(value.length >= 8){
                  runShellCommand('knxtool groupread local:/var/run/knx' + cellName + '0x' + firstVal + '0x' + secondVal);
              }else{
                  runShellCommand('knxtool read local:/var/run/knx' + cellName + '0x' + firstVal + '0x' + secondVal);
              }
              */
            }else{
            }
        }
    });

})()

function readKxnBusFloat16(value) {
  var byte1 = "0x" + value[3] + value[4];
  var byte2 = "0x" + value[8] + value[9];
  var data = parseInt(byte1, 16) * 256 + parseInt(byte2, 16);
  var sign = data >> 15;
  var exponent = (data >> 11) & 0x0f;
  var mantisse = data & 0x7ff;
  if (sign) {
	mantisse = -2048 + mantisse;
  }
  output =  (mantisse * (Math.pow(2, exponent)) / 100);
  return output;
};

function knxConvertToFloat16(value) {
    var sign = 0;
    var exp = 0;
    if (value < 0) {
        sign = 1;
    }

    var mant = Math.floor(value * 100);
    while ((mant < -2048) || (mant > 2047)) {
        mant = mant >> 1;
        exp += 1
    }

    var data = (sign << 15) | (exp << 11) | (mant & 0x07ff);
    return data;
};
