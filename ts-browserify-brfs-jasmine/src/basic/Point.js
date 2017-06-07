"use strict";
exports.__esModule = true;
var Point = (function () {
    function Point(x, y) {
        if (y === void 0) { y = 0; }
        this.y = y;
        this.x = x;
    }
    Point.prototype.dist = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    };
    Point.prototype.err1 = function () {
        return undefined;
    };
    Point.prototype.err = function () {
        return this.err1().toString();
    };
    return Point;
}());
Point.origin = new Point(0, 0);
exports.Point = Point;
