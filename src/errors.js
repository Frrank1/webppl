var stackTrace = require('stack-trace');
var SourceMap = require('source-map');
var colors = require('colors/safe');
var fs = require('fs');

function repeatString(string, count) {
  return Array(count).join(string);
}

function pad(pad, str, padLeft) {
  if (typeof str === 'undefined')
    return pad;
  if (padLeft) {
    return (pad + str).slice(-pad.length);
  } else {
    return (str + pad).substring(0, pad.length);
  }
}

function getArrow(length) {
  return '  ' + repeatString('-', length + 1) + '^\n';
}

function getContextMessage(source, lineNumber, columnNumber) {
  source = source.split('\n');
  var lineDigits = ('' + (lineNumber + 1)).length + 1;
  var padding = repeatString(' ', lineDigits);

  var previousPrefix = colors.dim(pad(padding, (lineNumber - 1), true) + '| ');
  var errorPrefix = colors.dim(pad(padding, lineNumber, true) + '| ');
  var followingPrefix = colors.dim(pad(padding, (lineNumber + 1), true) + '| ');

  var previousLine = source[lineNumber - 2] + '\n';
  var errorLine = colors.bold(source[lineNumber - 1]) + '\n';
  var followingLine = source[lineNumber] + '\n';

  previousLine = previousLine.trim().slice(0, 2) === '//' ? colors.dim(previousLine) : previousLine;
  followingLine = followingLine.trim().slice(0, 2) === '//' ? colors.dim(followingLine) : followingLine;

  var previousTotal = previousLine == 'undefined\n' ? '' : previousPrefix + previousLine;
  var errorTotal = errorPrefix + errorLine;
  var followingTotal = followingLine == 'undefined\n' ? '' : followingPrefix + followingLine;

  return previousTotal + errorTotal + (padding + getArrow(columnNumber)) + followingTotal;
}

function showFriendlyError(error) {
  if (!(error instanceof Error)) {
    // Probably a string from `throw message`.
    console.log(error);
    return;
  }

  // Note that `error.sourceMaps` will contain one of more source maps
  // if the error occurred while evaluating a webppl program.

  var pos = getErrorPosition(error);

  // This is Node specific in the browser we'll need something else. I
  // guess we need a source map for the whole browser bundle.
  var src = pos.sourceMapped ?
      getSrcFromMap(error.sourceMaps[0], pos.fileName) :
      fs.readFileSync(pos.fileName, 'utf8');

  writeFriendlyError(error, pos, src);
}

function getSrcFromMap(sourceMap, fileName) {
  var mapConsumer = new SourceMap.SourceMapConsumer(sourceMap);
  return mapConsumer.sourceContentFor(fileName);
}

function writeFriendlyError(error, pos, src) {
  console.log('\n' + colors.bold(error.message));
  console.log('    at ' + pos.fileName + ':' + pos.lineNumber + '\n');
  console.log(getContextMessage(src, pos.lineNumber, pos.columnNumber));

  if (error.stack) {
    console.log('Stack trace:');
    console.log(error.stack.slice(error.stack.indexOf('\n') + 1));
  }
}

function getErrorPosition(error) {

  var parsedError = stackTrace.parse(error);
  var firstStackFrame = parsedError[0];
  // Switch from 1 to 0 indexed.
  firstStackFrame.columnNumber--;
  firstStackFrame.sourceMapped = false;

  if (error.sourceMaps === undefined) {
    return firstStackFrame;
  }

  // Check whether the error occurred in compiled code. We only need
  // to check the first source map as this is the one added when the
  // error was first caught.

  var mapConsumer = new SourceMap.SourceMapConsumer(error.sourceMaps[0]);
  var originalPosition = mapConsumer.originalPositionFor({
    line: firstStackFrame.lineNumber,
    column: firstStackFrame.columnNumber
  });

  if (originalPosition.source === null) {
    return firstStackFrame;
  } else {
    return {
      fileName: originalPosition.source,
      lineNumber: originalPosition.line,
      columnNumber: originalPosition.column,
      sourceMapped: true
    };
  }
}

module.exports = {
  showFriendlyError: showFriendlyError
};
