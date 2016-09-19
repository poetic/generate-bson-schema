// Modules
var bsonTypeOfIs = require('bson-type-of-is')

// Constants
var DRAFT = "http://json-schema.org/draft-04/schema#"

function processArray (array, output, nested) {
  var oneOf
  var type

  if (nested && output) {
    output = {
      items: output
    }
  } else {
    output = output || {}
    output.type = bsonTypeOfIs(array)
    output.items = output.items || {}
  }

  // Determine whether each item is different
  for (var index = 0, length = array.length; index < length; index++) {
    var elementType = bsonTypeOfIs(array[index])

    if (type && elementType !== type) {
      output.items.oneOf = []
      oneOf = true
      break
    } else {
      type = elementType
    }
  }

  // Setup type otherwise
  if (!oneOf) {
    output.items.type = type
  }

  // Process each item depending
  if (typeof output.items.oneOf !== 'undefined' || type === 'object') {
    for (var index = 0, length = array.length; index < length; index++) {
      var value = array[index]
      var itemType = bsonTypeOfIs(value)
      var processOutput

      switch (itemType) {
        case "object":
          processOutput = processObject(value, oneOf ? {} : output.items.properties, true)
          break

        case "array":
          processOutput = processArray(value, oneOf ? {} : output.items.properties, true)
          break

        default:
          processOutput = { type: itemType }
      }

      if (oneOf) {
        output.items.oneOf.push(processOutput)
      } else {
        output.items.properties = processOutput
      }
    }
  }

  return nested ? output.items : output
}

function processObject (object, output, nested) {
  if (nested && output) {
    output = {
      properties: output
    }
  } else {
    output = output || {}
    output.type = bsonTypeOfIs(object)
    output.properties = output.properties || {}
  }

  for (var key in object) {
    var value = object[key]
    var type = bsonTypeOfIs(value)

    if (type === 'undefined') {
      type = 'null'
    }

    switch (type) {
      case "object":
        output.properties[key] = processObject(value)
        break

      case "array":
        output.properties[key] = processArray(value)
        break

      default:
        output.properties[key] = {
          type: type
        }
    }
  }

  return nested ? output.properties : output
}

module.exports = function (title, object) {
  var processOutput
  var output = {
    $schema: DRAFT
  }

  // Determine title exists
  if (typeof title !== 'string') {
    object = title
    title = undefined
  } else {
    output.title = title
  }

  // Set initial object type
  output.type = bsonTypeOfIs(object)

  // Process object
  switch (output.type) {
    case "object":
      processOutput = processObject(object)
      output.type = processOutput.type
      output.properties = processOutput.properties
      break

    case "array":
      processOutput = processArray(object)
      output.type = processOutput.type
      output.items = processOutput.items

      if (output.title) {
        output.items.title = output.title
        output.title += " Set"
      }

      break
  }

  // Output
  return output
}

