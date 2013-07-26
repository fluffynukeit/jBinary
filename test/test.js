var hasNodeRequire = typeof require === 'function' && !require.isBrowser;

if (hasNodeRequire) {
	if (typeof jDataView === 'undefined') {
		jDataView = require('jdataview');
	}

	if (typeof jBinary === 'undefined') {
		jBinary = require('..');
	}

	if (typeof JSHINT === 'undefined') {
		JSHINT = require('jshint').JSHINT;
	}

	if (typeof requirejs === 'undefined') {
		requirejs = require('requirejs');
	}
}

if (typeof JSHINT !== 'undefined') {
	asyncTest('JSHint', function (done) {
		var paths = {
			source: '../src/jbinary.js',
			options: '../src/.jshintrc'
		},
		contents = {};

		function onLoad(err, name, text) {
			if (err) {
				ok(false, 'Error while loading ' + name + ': ' + err);
				return done();
			}

			contents[name] = text;
			for (var name in paths) {
				if (!(name in contents)) {
					return;
				}
			}

			var options = JSON.parse(contents.options), globals = options.globals;
			delete options.globals;

			if (JSHINT(contents.source, options, globals)) {
				ok(true);
			} else {
				var errors = JSHINT.errors, skipLines = [], errorCount = errors.length;
				for (var i = 0, length = errors.length; i < length; i++) {
					var error = errors[i];
					if (error) {
						if (error.code === 'E001' && /\/\/\s*jshint:\s*skipline/.test(error.evidence)) {
							skipLines.push(error.line + 1);
							errorCount--;
							continue;
						}
						if (skipLines.indexOf(error.line) >= 0) {
							errorCount--;
							continue;
						}
						ok(false, 'Line ' + error.line + ', character ' + error.character + ': ' + error.reason);
						console.log(error);
					} else {
						errorCount--;
					}
				}
				if (!errorCount) {
					ok(true);
				}
			}

			done();
		}

		function load(name) {
			if (typeof XMLHttpRequest !== 'undefined') {
				var ajax = new XMLHttpRequest();
				ajax.onload = function () {
					(this.status === 0 || this.status === 200) ? onLoad(null, name, this.responseText) : onLoad(this.statusText, name);
				};
				ajax.open('GET', paths[name], true);
				ajax.send();
			} else {
				require('fs').readFile(paths[name], function (err, data) {
					onLoad(err, name, String(data));
				});
			}
		}

		for (var name in paths) {
			load(name);
		}
	});
}

asyncTest('require.js', function (done) {
	requirejs.config({
		baseUrl: '../..',
		paths: {
			jbinary: 'jBinary/src/jbinary',
			jdataview: 'jDataView/src/jdataview'
		}
	});

	requirejs(['jbinary'], function (module) {
		ok(module);
		done();
	});
});

var
	module = suite,
	chr = String.fromCharCode,
	// workaround for http://code.google.com/p/v8/issues/detail?id=2578
	_isNaN = Number.isNaN || window.isNaN,
	isNaN = function (obj) {
		return _isNaN(obj) || (typeof obj === 'number' && obj.toString() === 'NaN');
	},
	dataBytes = [
		0x00,
		0xff, 0xfe, 0xfd, 0xfc,
		0xfa, 0x00, 0xba, 0x01
	],
	dataStart = 1,
	view = new jDataView(dataBytes.slice(), dataStart, undefined, true),
	binary = new jBinary(view, {__UNUSED__: '__UNUSED__'}),
	typeSet = jBinary.prototype.typeSet,
	ObjectStructure = {
		arrays: ['array', {
			flag: ['enum', 'uint8', [false, true]],
			array: ['if', 'flag', {
				length: 'uint8',
				values: ['array', 'uint16', 'length']
			}]
		}, 2]
	},
	ExtensionStructure = {
		extraByte: 'uint8'
	};

for (var typeName in typeSet) {
	typeSet[typeName].isTested = {getter: false, setter: false};
}

var _test = test;
test = function(name) {
	name = name.replace(/(^|_)(.)/g, function (m, p, c) { return c.toUpperCase() });
	_test.apply(null, arguments);
}

function b() {
	return new jBinary(arguments);
}

function compareInt64(value, expected) {
	equal(Number(value), expected);
}

function compareBytes(value, expected) {
	deepEqual(Array.prototype.slice.call(value), expected);
}

function compareWithNaN(value) {
	ok(isNaN(value));
}

// getter = value || {value, check?, binary?, args?, offset?}
function testGetters(typeName, getters) {
	typeSet[typeName].isTested.getter = true;

	test(typeName, function () {
		binary.seek(0);

		for (var i = 0; i < getters.length; i++) {
			var getter = getters[i];

			if (typeof getter !== 'object') {
				getter = {value: getter};
			}

			var args = getter.args,
				type = args ? [typeName].concat(args) : typeName,
				offset = getter.offset,
				contextBinary = getter.binary || binary,
				check = getter.check || equal,
				value = getter.value;

			if (offset !== undefined) {
				contextBinary.seek(offset);
			}

			check(contextBinary.read(type), value);
		}
	});
}

// setter = value || {value, args?, check?}
function testSetters(typeName, setters) {
	typeSet[typeName].isTested.setter = true;

	test(typeName, function () {
		for (var i = 0; i < setters.length; i++) {
			var setter = setters[i];

			if (typeof setter !== 'object') {
				setter = {value: setter};
			}

			var args = setter.args,
				type = args ? [typeName].concat(args) : typeName,
				check = setter.check || equal,
				value = setter.value;

			binary.write(type, value, 0);
			binary._bitShift = 0;
			check(binary.read(type, 0), value);
			binary._bitShift = 0;
		}
	});
}

function testCoverage(typeName) {
	test(typeName, function () {
		var isTested = typeSet[typeName].isTested;
		ok(isTested.getter, 'Getter tests');
		ok(isTested.setter, 'Setter tests');
	});
}

test('getType', function () {
	var type = binary.getType('uint32');
	ok(type instanceof jBinary.Type);
	equal(binary.getType([type]), type);
});

//-----------------------------------------------------------------

module('Loading data');

asyncTest('loadData from data-URI', function (done) {
	jBinary.loadData('data:text/plain,123', function (err, data) {
		ok(!err);
		equal(new jDataView(data).getString(), '123');
		done();
	});
});

asyncTest('loadData from base-64 data-URI', function (done) {
	jBinary.loadData('data:text/plain;base64,MTIz', function (err, data) {
		ok(!err);
		equal(new jDataView(data).getString(), '123');
		done();
	});
});

if (typeof Blob !== 'undefined') {
	asyncTest('loadData from HTML5 Blob', function (done) {
		var blob = new Blob(['123']);
		jBinary.loadData(blob, function (err, data) {
			ok(!err);
			equal(new jDataView(data).getString(), '123');
			done();
		});
	});
}

asyncTest('loadData from local file', function (done) {
	jBinary.loadData('123.tar', function (err, data) {
		ok(!err);
		equal(data.byteLength || data.length, 512);
		done();
	});
});

asyncTest('loadData from non-existent local file', function (done) {
	jBinary.loadData('__NON_EXISTENT__', function (err, data) {
		ok(err);
		ok(!data);
		done();
	});
});

if (hasNodeRequire) {
	asyncTest('Node.js readable stream', function (done) {
		var stream = require('stream').Readable(), i = 0;
		stream._read = function () {
			i++;
			this.push(i <= 3 ? new Buffer([i]) : null);
		};
		jBinary.loadData(stream, function (err, data) {
			ok(!err);
			deepEqual(Array.prototype.slice.call(data), [1, 2, 3]);
			done();
		});
	});
}

//-----------------------------------------------------------------

module('Value Read');

testGetters('blob', [
	{offset: 1, args: [2], value: [0xfe, 0xfd], check: compareBytes},
	{args: [3], value: [0xfc, 0xfa, 0x00], check: compareBytes}
]);

testGetters('char', [
	chr(0xff),
	chr(0xfe),
	chr(0xfd),
	chr(0xfc),
	chr(0xfa),
	chr(0),
	chr(0xba),
	chr(1)
]);

testGetters('string', [
	{offset: 0, args: [1], value: chr(0xff)},
	{offset: 5, args: [1], value: chr(0)},
	{offset: 7, args: [1], value: chr(1)},
	{binary: b(127, 0, 1, 65, 66), args: [5], value: chr(127) + chr(0) + chr(1) + chr(65) + chr(66)},
	{binary: b(0xd1, 0x84, 0xd1, 0x8b, 0xd0, 0xb2), args: [6, 'utf8'], value: chr(1092) + chr(1099) + chr(1074)}
]);

testGetters('string0', [
	{offset: 0, args: [8], value: chr(0xff) + chr(0xfe) + chr(0xfd) + chr(0xfc) + chr(0xfa)},
	{binary: b(127, 0, 1, 65, 66), value: chr(127)}
]);

testGetters('int8', [
	-1,
	-2,
	-3,
	-4,
	-6,
	0,
	-70,
	1
]);

testGetters('uint8', [
	255,
	254,
	253,
	252,
	250,
	0,
	186,
	1
]);

testGetters('int16', [
	{offset: 0, value: -257},
	{offset: 1, value: -514},
	{offset: 2, value: -771},
	{offset: 3, value: -1284},
	{offset: 4, value: 250},
	{offset: 5, value: -17920},
	{offset: 6, value: 442}
]);

testGetters('uint16', [
	{offset: 0, value: 65279},
	{offset: 1, value: 65022},
	{offset: 2, value: 64765},
	{offset: 3, value: 64252},
	{offset: 4, value: 250},
	{offset: 5, value: 47616},
	{offset: 6, value: 442}
]);

testGetters('uint32', [
	{offset: 0, value: 4244504319},
	{offset: 1, value: 4210884094},
	{offset: 2, value: 16448765},
	{offset: 3, value: 3120626428},
	{offset: 4, value: 28967162}
]);

testGetters('int32', [
	{offset: 0, value: -50462977},
	{offset: 1, value: -84083202},
	{offset: 2, value: 16448765},
	{offset: 3, value: -1174340868},
	{offset: 4, value: 28967162}
]);

testGetters('float32', [
	{offset: 0, value: -1.055058432344064e+37},
	{offset: 1, value: -6.568051909668895e+35},
	{offset: 2, value: 2.30496291345398e-38},
	{offset: 3, value: -0.0004920212086290121},
	{offset: 4, value: 6.832701044000979e-38},
	{binary: b(0x7f, 0x80, 0x00, 0x00), value: Infinity},
	{binary: b(0xff, 0x80, 0x00, 0x00), value: -Infinity},
	{binary: b(0x00, 0x00, 0x00, 0x00), value: 0},
	{binary: b(0xff, 0x80, 0x00, 0x01), check: compareWithNaN}
]);

testGetters('float64', [
	{offset: 0, value: 2.426842827241402e-300},
	{binary: b(0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), value: Infinity},
	{binary: b(0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), value: -Infinity},
	{binary: b(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), value: 0},
	{binary: b(0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), value: -0},
	{binary: b(0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), value: 1},
	{binary: b(0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01), value: 1.0000000000000002},
	{binary: b(0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02), value: 1.0000000000000004},
	{binary: b(0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), value: 2},
	{binary: b(0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), value: -2},
	{binary: b(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01), value: 5e-324},
	{binary: b(0x00, 0x0f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff), value: 2.225073858507201e-308},
	{binary: b(0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), value: 2.2250738585072014e-308},
	{binary: b(0x7f, 0xef, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff), value: 1.7976931348623157e+308},
	{binary: b(0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01), check: compareWithNaN}
]);

testGetters('int64', [
	{offset: 0, args: [false], value: -283686985483775, check: compareInt64},
	{binary: b(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe), value: -2, check: compareInt64},
	{binary: b(0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77), value: 4822678189205111, check: compareInt64}
]);

testGetters('uint64', [
	{binary: b(0x00, 0x67, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe), value: 29273397577908224, check: compareInt64},
	{binary: b(0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77), value: 4822678189205111, check: compareInt64}
]);

typeSet.skip.isTested.getter = true;
test('skip', function () {
	binary.read(['skip', 2]);
	equal(binary.tell(), 2);
	binary.read(['skip', 1]);
	equal(binary.tell(), 3);
});

testGetters('enum', [
	{offset: 5, args: ['uint8', [false, true]], value: false},
	{offset: 7, args: ['uint8', {'0': 'false', '1': 'true'}], value: 'true'}
]);

testGetters('array', [
	{offset: 0, args: ['uint16', 2], value: [65279, 64765], check: deepEqual},
	{offset: 5, args: ['uint8'], value: [0x00, 0xba, 0x01], check: deepEqual}
]);

typeSet['const'].isTested.getter = true;
test('const', function () {
	try {
		binary.read(['const', 'uint16', 0, true], 0);
		ok(false);
	} catch (e) {
		ok(true);
	}

	try {
		notEqual(binary.read(['const', 'uint8', 0], 0), 0);
	} catch (e) {
		ok(false);
	}

	var errorFlag = false;
	binary.read(['const', 'uint8', 123, function (value) {
		equal(value, 0xff);
		equal(this.value, 123);
		errorFlag = true;
	}], 0);
	ok(errorFlag);
});

testGetters('if', [
	{offset: 0, args: [true, 'uint8'], value: 0xff},
	{offset: 0, args: [function () { return false }, 'uint8', 'uint16'], value: 65279}
]);

testGetters('if_not', [
	{offset: 0, args: [false, 'uint8'], value: 0xff},
	{offset: 0, args: [function () { return false }, 'uint16', 'uint8'], value: 65279}
]);

testGetters('bitfield', [
	// padded to byte here
	{offset: 1, args: [3], value: 7},
	{args: [5], value: 30},
	// padded to byte here
	{args: [15], value: 32510},
	{args: [17], value: 64000}
	// padded to byte here
]);

testGetters('object', [{
	binary: b(0x01, 0x02, 0xff, 0xfe, 0xfd, 0xfc, 0x00, 0x10),
	args: [ObjectStructure],
	value: {
		arrays: [
			{
				flag: true,
				array: {
					length: 2,
					values: [0xfffe, 0xfdfc]
				}
			},
			{
				flag: false
			}
		]
	},
	check: deepEqual
}]);

testGetters('extend', [{
	binary: b(0x01, 0x02, 0xff, 0xfe, 0xfd, 0xfc, 0x00, 0x10),
	args: [ObjectStructure, ExtensionStructure],
	value: {
		arrays: [
			{
				flag: true,
				array: {
					length: 2,
					values: [0xfffe, 0xfdfc]
				}
			},
			{
				flag: false
			}
		],
		extraByte: 0x10
	},
	check: deepEqual
}]);

testGetters('binary', [{
	offset: 1,
	args: [3, {__TEST_ME__: '__TEST_ME__'}],
	value: [0xfe, 0xfd, 0xfc],
	check: function (subBinary, values) {
		deepEqual(subBinary.read(['array', 'uint8'], 0), values);
		equal(subBinary.view.buffer, binary.view.buffer);
		equal(subBinary.typeSet.__TEST_ME__, '__TEST_ME__');
	}
}]);

typeSet.lazy.isTested.getter = true;
test('lazy', function () {
	var innerType = 'uint32',
		length = 4,
		lazyType = ['lazy', innerType, length],
		lazy,
		readCount,
		innerValue = binary.read(innerType, 0);

	function resetAccessor() {
		lazy = binary.read(lazyType, 0);
		ok(!('value' in lazy));
		readCount = 0;
		var read = lazy.binary.read;
		lazy.binary.read = function () {
			readCount++;
			return read.apply(this, arguments);
		};
	}

	function checkState(expectedChangeState, expectedReadCount) {
		equal(!!lazy.wasChanged, expectedChangeState);
		for (var counter = 2; counter--;) {
			equal(lazy(), innerValue);
		}
		equal(readCount, expectedReadCount);
		equal(lazy.value, innerValue);
	}
	
	resetAccessor();
	checkState(false, 1);

	innerValue = 5489408;
	lazy(innerValue);
	checkState(true, 1);

	resetAccessor();
	lazy(innerValue);
	checkState(true, 0);
});

//-----------------------------------------------------------------

module('Value Write', {
	teardown: function () {
		binary.write('blob', dataBytes.slice(dataStart), 0);
	}
});

testSetters('blob', [
	{args: [2], value: [0xfe, 0xfd], check: compareBytes},
	{args: [3], value: [0xfd, 0xfe, 0xff], check: compareBytes}
]);

testSetters('char', [
	chr(0xdf),
	chr(0x03),
	chr(0x00),
	chr(0xff)
]);

testSetters('string', [
	{args: [3], value: chr(1) + chr(2) + chr(3)},
	{args: [2], value: chr(8) + chr(9)},
	{args: [6, 'utf8'], value: chr(1092) + chr(1099) + chr(1074)}
]);

testSetters('string0', [
	{args: [4], value: chr(0xff) + chr(0xfe) + chr(0xfd), check: function (value, expected) {
		equal(value, expected);
		equal(binary.read('uint8', value.length), 0);
	}},
	{value: chr(127) + chr(0) + chr(1) + chr(65) + chr(66), check: function (value, expected) {
		equal(value, expected.slice(0, value.length));
		equal(binary.read('uint8', value.length), 0);
	}}
]);

testSetters('int8', [
	-10,
	29
]);

testSetters('uint8', [
	19,
	129,
	0,
	255,
	254
]);

testSetters('int16', [
	-17593,
	23784
]);

testSetters('uint16', [
	39571,
	35
]);

testSetters('int32', [
	-1238748268,
	69359465
]);

testSetters('uint32', [
	3592756249,
	257391
]);

testSetters('float32', [
	Math.pow(2, -149),
	-Math.pow(2, -149),
	Math.pow(2, -126),
	-Math.pow(2, -126),
	-1.055058432344064e+37,
	-6.568051909668895e+35,
	2.30496291345398e-38,
	-0.0004920212086290121,
	6.832701044000979e-38,
	Infinity,
	-Infinity,
	0,
	{value: NaN, check: compareWithNaN}
]);

testSetters('float64', [
	Math.pow(2, -1074),
	-Math.pow(2, -1074),   
	Math.pow(2, -1022),
	-Math.pow(2, -1022),
	2.426842827241402e-300,
	Infinity,
	-Infinity,
	0,
	1,
	1.0000000000000004,
	-2,
	{value: NaN, check: compareWithNaN}
]);

testSetters('int64', [
	{value: -283686985483775, check: compareInt64},
	{value: -2, check: compareInt64},
	{value: 4822678189205111, check: compareInt64}
]);

testSetters('uint64', [
	{value: 29273397577908224, check: compareInt64},
	{value: 4822678189205111, check: compareInt64}
]);

typeSet.skip.isTested.setter = true;
test('skip', function () {
	binary.seek(0);
	binary.write(['skip', 2]);
	equal(binary.tell(), 2);
	binary.write(['skip', 1]);
	equal(binary.tell(), 3);
});

testSetters('enum', [
	{args: ['uint8', {'0': false, '1': true}], value: false},
	{args: ['uint8', ['false', 'true']], value: 'true'}
]);

testSetters('array', [
	{args: ['uint16', 2], value: [65279, 64765], check: deepEqual},
	{args: ['uint8', 3], value: [0x00, 0xba, 0x01], check: deepEqual}
]);

typeSet['const'].isTested.setter = true;
test('const', function () {
	var type = ['const', 'uint16', 123, true];

	try {
		binary.write(type.slice(0, -1), 10, 0);
		binary.read(type, 0);
		ok(false);
	} catch (e) {
		ok(true);
	}

	try {
		binary.write(type, 10, 0);
		equal(binary.read(type, 0), 123);
	} catch (e) {
		ok(false);
	}
});

testSetters('if', [
	{args: [true, 'uint8'], value: 123},
	{args: [function () { return false }, 'uint8', 'uint16'], value: 17893}
]);

testSetters('if_not', [
	{args: [false, 'uint8'], value: 123},
	{args: [function () { return false }, 'uint16', 'uint8'], value: 17893}
]);

testSetters('bitfield', [
	// padded to byte here
	{args: [3], value: 5},
	{args: [5], value: 29},
	// padded to byte here
	{args: [15], value: 19781},
	{args: [17], value: 68741}
	// padded to byte here
]);

testSetters('object', [{
	args: [ObjectStructure],
	value: {
		arrays: [
			{
				flag: true,
				array: {
					length: 2,
					values: [0xfffe, 0xfdfc]
				}
			},
			{
				flag: false
			}
		]
	},
	check: deepEqual
}]);

testSetters('extend', [{
	args: [ObjectStructure, ExtensionStructure],
	value: {
		arrays: [
			{
				flag: true,
				array: {
					length: 2,
					values: [0xfffe, 0xfdfc]
				}
			},
			{
				flag: false
			}
		],
		extraByte: 0x10
	},
	check: deepEqual
}]);

testSetters('binary', [
	{
		args: [2],
		value: new jBinary([0x12, 0x34]),
		check: function (readBinary, writeBinary) {
			deepEqual(readBinary.read(['array', 'uint8'], 0), writeBinary.read(['array', 'uint8'], 0));
			equal(readBinary.view.buffer, binary.view.buffer);
		}
	}
]);

typeSet.lazy.isTested.setter = true;
test('lazy', function () {
	var innerType = 'uint32',
		length = 4,
		lazyType = ['lazy', innerType, length],
		blobType = ['array', 'uint8', length],
		newBinary = new jBinary(length),
		nativeAccessor = binary.read(lazyType, 0),
		externalValue = 7849234,
		externalAccessor = function () {
			return externalValue;
		};

	newBinary.write(lazyType, nativeAccessor);
	equal(newBinary.tell(), length);
	ok(!('value' in nativeAccessor));
	deepEqual(binary.read(blobType, 0), newBinary.read(blobType, 0));

	newBinary.seek(0);
	newBinary.write(lazyType, externalAccessor);
	deepEqual(newBinary.read(innerType, 0), externalValue);
});

test('slice', function () {
	try {
		binary.slice(5, 10);
		ok(false);
	} catch(e) {
		ok(true);
	}

	var pointerCopy = binary.slice(1, 4);
	compareBytes(pointerCopy.read('blob'), [0xfe, 0xfd, 0xfc]);
	pointerCopy.write('char', chr(1), 0);
	equal(binary.read('char', 1), chr(1));
	pointerCopy.write('char', chr(0xfe), 0);
	equal(pointerCopy.typeSet, binary.typeSet);

	var copy = binary.slice(1, 4, true);
	compareBytes(copy.read('blob'), [0xfe, 0xfd, 0xfc]);
	copy.write('char', chr(1), 0);
	notEqual(binary.read('char', 1), chr(1));
	equal(pointerCopy.typeSet, binary.typeSet);
});

//-----------------------------------------------------------------

module('Type Coverage');

for (var typeName in typeSet) {
	testCoverage(typeName);
}