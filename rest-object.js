'use strict';

function DataObject(){
  var self = this;

  var m_object = 'unknown';
  var m_properties = {};

  this.id = null;
  this.isDataObject = true;

  function construct( type, properties ){

    if( arguments.length==1 ){

      properties = type;

    } else {

      m_object = type;
    }

    if( isObject(properties) ){

      for( var i in properties ){

        setProperty( i, properties[i] );
      }
    }
  }

  function isObject( data ){

    return data!=undefined && data!=null && typeof data=="object";
  }

  function isArray( data ){

    return isObject(data) && data.length!=undefined;
  }

  function inArray( obj, array ){

    for( var i=0; i<array.length; i++ ){

      if( array[i]==obj )
        return true;
    }

    return false;
  }

  function setProperty( name, value ){

    if( name=='id' ){

      self.id = value;
      return;
    }

    if( name=='__type' ){

      m_object = value;
      return;
    }

    if( m_properties[name]==undefined ){

      Object.defineProperty(self, name, {
          get: function() { return getProperty(name); },
          set: function(newValue) { setProperty(name, newValue); },
          enumerable: true,
          configurable: true
      });
    }

    if( isArray(value) ){

      m_properties[name] = DataObject.array(value);

    } else if( isObject(value) ){

      m_properties[name] = new DataObject(value);

    } else {

      m_properties[name] = value;
    }
  }

  function getProperty( name ){

    return m_properties[name];
  }

  this.json = function( includeID, exclude ){

    var json = {};

    if( exclude==undefined )
      exclude = [];

    if( includeID && self.id )
      json.id = self.id;

    for( var i in m_properties ){

      if( !inArray(i, exclude) ){

          var value = m_properties[i];

          if( isArray(value) ){

              var collection = [];
              for( var j=0; j<value.length; j++ ){
                  collection.push(value[j].json(includeID));
              }
              json[i] = collection;

          } else if( isObject(value) ) {

              json[i] = value.json(includeID);

          } else {

              json[i] = value;
          }
      }
    }

    return json;
  };

  this.get = function( property ){

    return getProperty(property);
  };

  this.set = function( property, value ){

    setProperty(property, value);
  };

  this.push = function( property, value ){

    if( !isArray(m_properties[property]) ){

      m_properties[property] = [];
    }

    m_properties[property].push(value);
  };

  this.getType = function () {

    return m_object;
  };

  construct.apply(self, arguments);
}

DataObject.array = function( values ){

  var collection = [];

  for( var i=0; i<values.length; i++ ){

    collection.push(new DataObject(values[i]));
  }

  return collection;
};

module.exports = DataObject;
