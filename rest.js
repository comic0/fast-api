'use strict';

var http = require('http');
var url = require('url');
var DataObject = require('./rest-object');

var sharedManager = null;

function FastApiQuery(){
  var self = this;

  var m_type = null;
  var m_object = null;
  var m_includes = [];
  var m_limit = null;
  var m_offset = null;
  var m_full = false;
  var m_filter = '';
  var m_data = null;
  var m_where = {};

  function construct( type, object, filters ){

    m_type = type;
    m_object = object;

    if( typeof filters=="object" ){

      m_where = filters;

    } else {

      m_filter = filters;
    }
  }

  this.limit = function( limit, offset ){

    if( offset==undefined )
      offset = 0;

    m_limit = limit;
    m_offset = offset;
    return this;
  };

  this.full = function(){

    m_full = true;
    return this;
  };

  this.include = function(){

    m_includes = [];

    for( var i=0; i<arguments.length; i++ ){
      m_includes.push(arguments[i]);
    }

    return this;
  };

  this.setData = function (data) {
    m_data = data;
  };

  this.getType = function(){

    return m_type;
  };

  this.getPath = function(){

    var components = [m_object];

    if( m_filter ){
      components.push(m_filter);
    }

    var params = {};

    if( m_includes.length>0 )
      params.include = m_includes.join(',');
    if( m_limit )
      params.limit = parseInt(m_limit);
    if( m_offset )
      params.offset = parseInt(m_offset);
    if( m_full )
      params.full = 1;

    for( var key in m_where ){
      params['where_'+key] = m_where[key];
    }

    var path = components.join('/')+'?';

    for( var key in params ){
      path += key + '=' + params[key] + '&';
    }

    return path;
  };

  this.getData = function () {

    return m_data;
  };

  this.getEncodedData = function(){

    return JSON.stringify(m_data);
  };

  construct.apply(self, arguments);
}

function FastApiManager(){
  var self = this;

  var m_hostname;
  var m_rootpath;
  var m_query;

  function construct( apiUrl ){

    var uri = url.parse(apiUrl);

    m_hostname = uri.hostname;
    m_rootpath = uri.pathname;

    console.log( "New manager available", apiUrl);
  }

  function parseResult( data ){

    if( !data )
      return data;

    if( data.length!=undefined )
      return DataObject.array(data);

    return new DataObject(data);
  }

  this.init = function( query ){

    m_query = query;
    return self;
  };

  this.prepare = function( prepare ){

    if( typeof prepare == 'function' ){
      prepare(m_query);
    }

    return new Promise(function (resolve, reject) {

      var options = {
        hostname: m_hostname,
        path: m_rootpath + m_query.getPath(),
        method: m_query.getType().toUpperCase(),
        headers: {
          'Content-Type': 'application/json'
        }
      };

      var request = http.request(options, (res) => {

        res.setEncoding('utf8');
        res.on('data', (data) => {

          try {

            var data = JSON.parse(data);
            if( data.success ){
              resolve(parseResult(data.result));
            } else {
              reject(data.message);
            }

          } catch (e){
            reject(e.message);
          }
        });
      });

      request.on('error', function(e){
        reject(e.message);
      });

      if( m_query.getData()!=null ){
        request.write(m_query.getEncodedData());
      }

      request.end();
    });
  };

  construct.apply(self, arguments);
}

module.exports = {
  configure: function( url ){

    sharedManager = new FastApiManager( url );
  },
  get: function ( object, filters, prepare ) {

    if( arguments.length==2 && typeof filters=='function'){

      prepare = filters;
      filters = undefined;
    }

    if( typeof prepare!='function' ) {
      prepare = function(){};
    }

    var query = new FastApiQuery( 'get', object, filters );
    return sharedManager.init(query).prepare(prepare);
  },
  update: function( object ){

    var query = new FastApiQuery( 'post', object.getType(), object.id );
    query.setData(object.json());
    return sharedManager.init(query).prepare();
  },
  insert: function( object ){

    var query = new FastApiQuery( 'put', object.getType() );
    query.setData(object.json());
    return sharedManager.init(query).prepare();
  }
};
