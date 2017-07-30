

/*
* Convert From/To Binary/Decimal/Hexadecimal in JavaScript
* https://gist.github.com/faisalman
*
* Copyright 2012-2015, Faisalman <fyzlman@gmail.com>
* Licensed under The MIT License
* http://www.opensource.org/licenses/mit-license
*/
/*
* Usage example:
var ConvertBase = require('./baseConverter')
* ConvertBase.bin2dec('111'); // '7'
* ConvertBase.dec2hex('42'); // '2a'
* ConvertBase.hex2bin('f8'); // '11111000'
* ConvertBase.dec2bin('22'); // '10110'
*/

var ConvertBase = function (num) {
    return {
        from : function (baseFrom) {
            return {
                to : function (baseTo) {
                    return parseInt(num, baseFrom).toString(baseTo);
                }
            };
        }
    };
};
    
// binary to decimal
ConvertBase.bin2dec = function (num) {
    return ConvertBase(num).from(2).to(10);
};

// binary to hexadecimal
ConvertBase.bin2hex = function (num) {
    return ConvertBase(num).from(2).to(16);
};

// decimal to binary
ConvertBase.dec2bin = function (num) {
    return ConvertBase(num).from(10).to(2);
};

// decimal to hexadecimal
ConvertBase.dec2hex = function (num) {
    return ConvertBase(num).from(10).to(16);
};

// hexadecimal to binary
ConvertBase.hex2bin = function (num) {
    return ConvertBase(num).from(16).to(2);
};

// hexadecimal to decimal
ConvertBase.hex2dec = function (num) {
    return ConvertBase(num).from(16).to(10);
};




// my own utilities
function dec2bin(number, arrayLength){
    var a =  string2array(ConvertBase.dec2bin(number))
    if(arrayLength){
        if(a.length>arrayLength){
            throw new Error('array length already exeeded by input')
        }
        var diff = arrayLength-a.length
        for (var i = 0; i < diff; i++) {
            a.unshift(0)
        }
    }
    return a
}
function bin2dec(number){
    return Math.round(ConvertBase.bin2dec(number.join('')))
}
function string2array(s){
    var ints = []
    for (var i = 0; i < s.length; i++) {
        ints.push(Math.round(parseFloat(s[i])))
    }
    return ints
}
module.exports = {
    dec2bin, bin2dec
}
