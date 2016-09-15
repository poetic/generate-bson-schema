// BSON types
// Type                    Number       Alias
// Double                  1            “double”
// String                  2            “string”
// Object                  3            “object”
// Array                   4            “array”
// BinaryData              5            “binData”
// Undefined               6            “undefined”
// ObjectId                7            “objectId”
// Boolean                 8            “bool”
// Date                    9            “date”
// Null                    10           “null”
// RegularExpression       11           “regex”
// DBPointer               12           “dbPointer”
// JavaScript              13           “javascript”
// Symbol                  14           “symbol”
// JavaScript(withScope)   15           “javascriptWithScope”
// 32-bitInteger           16           “int”
// Timestamp               17           “timestamp”
// 64-bitInteger           18           “long”
// MinKey                  -1           “minKey”
// MaxKey                  127          “maxKey”

var types = [
  {
    alias: 'double',
    check: function (v, type, bsontype) { return bsontype === 'Double' }
  },
  {
    alias: 'string',
    check: function (v, type) { return type === 'string' }
  },
  {
    alias: 'array',
    check: function (v) { return Array.isArray(v) }
  },
  {
    alias: 'binData',
    check: function (v, type, bsontype) { return bsontype === 'Binary' }
  },
  // {
  //   alias: 'undefined',
  //   check: function (v, type) { return type === 'undefined' }
  // },
  {
    alias: 'objectId',
    check: function (v, type, bsontype) { return bsontype === 'ObjectID' }
  },
  {
    alias: 'bool',
    check: function (v, type) { return type === 'boolean' }
  },
  {
    alias: 'date',
    check: function (v) { return v instanceof Date }
  },
  // {
  //   alias: 'null',
  //   check: function (v) { return v === null }
  // },
  {
    alias: 'regex',
    check: function (v, type, bsontype) { return bsontype === 'BSONRegExp' }
  },
  {
    alias: 'dbPointer',
    check: function (v, type, bsontype) { return bsontype === 'DBRef' }
  },
  // { alias: 'javascript', check: function (v) { } },
  {
    alias: 'symbol',
    check: function (v, type, bsontype) { return bsontype === 'Symbol' }
  },
  // { alias: 'javascriptWithScope', check: function (v) { return  } },
  {
    alias: 'int',
    check: function (v, type, bsontype) { return bsontype === 'Int32' }
  },
  {
    alias: 'timestamp',
    check: function (v, type, bsontype) { return bsontype === 'Timestamp' }
  },
  {
    alias: 'long',
    check: function (v, type, bsontype) { return bsontype === 'Long' }
  },
  // { alias: 'minKey', check: function (v) { return  } },
  // { alias: 'maxKey', check: function (v) { return  } },
  // NOTE: object should be at the end
  {
    alias: 'object',
    check: function (v, type) { return type === 'object' }
  },
]

// recognize bson types
function typeOf (value) {
  if (value === null) {
    return 'null'
  }

  var type = typeof value

  if (type === 'undefined') {
    return 'undefined'
  }

  var bsontype = value._bsontype

  var i
  for (i = 0; i < types.length; i++) {
    if (types[i].check(value, type, bsontype)) {
      return types[i].alias
    }
  }
  // Unrecognized type
  throw {
    message: 'This value has a type we do not recognize',
    value: value
  }
}

// Constants
var DRAFT = "http://json-schema.org/draft-04/schema#"

function getUniqueKeys (a, b, c) {
  var a = Object.keys(a)
  var b = Object.keys(b)
  var c = c || []
  var value
  var cIndex
  var aIndex

  for (var keyIndex = 0, keyLength = b.length; keyIndex < keyLength; keyIndex++) {
    value = b[keyIndex]
    aIndex = a.indexOf(value)
    cIndex = c.indexOf(value)

    if (aIndex === -1) {
      if (cIndex !== -1) {
        // Value is optional, it doesn't exist in A but exists in B(n)
        c.splice(cIndex, 1)
      }
    } else if (cIndex === -1) {
      // Value is required, it exists in both B and A, and is not yet present in C
      c.push(value)
    }
  }

  return c
}

function processArray (array, output, nested) {
  var oneOf
  var type

  if (nested && output) {
    output = {
      items: output
    }
  } else {
    output = output || {}
    output.type = typeOf(array)
    output.items = output.items || {}
  }

  // Determine whether each item is different
  for (var index = 0, length = array.length; index < length; index++) {
    var elementType = typeOf(array[index])

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
      var itemType = typeOf(value)
      var required = []
      var processOutput

      switch (itemType) {
        case "object":
          if (output.items.properties) {
            output.items.required = getUniqueKeys(output.items.properties, value, output.items.required)
          }

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
    output.type = typeOf(object)
    output.properties = output.properties || {}
  }

  for (var key in object) {
    var value = object[key]
    var type = typeOf(value)

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
  output.type = typeOf(object)

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

