"use strict";
exports.__esModule = true;
var inputUtil_1 = require("../src/inputUtil");
var baseConverter_1 = require("../src/baseConverter");
describe('util', function () {
    it('buildNumber', function () {
        expect([baseConverter_1.dec2bin(13), inputUtil_1.buildNumber(13, 8), baseConverter_1.bin2dec(inputUtil_1.buildNumber(13, 8))]).toEqual([[1, 1, 0, 1], [
                0, 0, 0, 0,
                1, 1, 0, 1
            ], 13]);
    });
});
//# sourceMappingURL=inputUtilSpec.js.map