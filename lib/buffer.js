
function Buffer() {
  this._str = '';
};

Buffer.prototype.push = function(str) {
  this._str += str;
}

Buffer.prototype.toString = function() {
  return this._str;
}