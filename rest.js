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

  var m_url;
  var m_logged;
  var m_hostname;
  var m_rootpath;
  var m_query;
  var m_apiKey;
  var m_pushTable;

  function construct( apiUrl, apiKey, pushTable ){

    m_url = apiUrl;

    var uri = url.parse(apiUrl);

    m_logged = null;
    m_apiKey = apiKey;
    m_pushTable = pushTable;
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

  function getHeaders() {

    var headers = {
        'Content-Type': 'application/json',
        'X-Fast-Api-Key': m_apiKey
    };

    if( m_logged ){

        headers['X-Api-Logged-Id'] = m_logged.id;
        headers['X-Api-Logged-Type'] = m_logged.getType();
    }

    return headers;
  }

  this.init = function( query ){

    m_query = query;
    return self;
  };

  this.login = function( object ){

    m_logged= object;
  };

  this.currentUser = function(){

    return m_logged;
  };

  this.logout = function(){

    m_logged = null;
  };

  this.getUploadUrl = function(){

    return m_url + '/upload';
  };

  this.push = function( title, message, filters ){

      return new Promise(function (resolve, reject) {

          var headers = getHeaders();

          var options = {
              hostname: m_hostname,
              path: m_rootpath + 'push',
              method: 'POST',
              headers: headers
          };

          var request = http.request(options, function (res) {

              res.setEncoding('utf8');
              res.on('data', function(data){

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

          request.write(JSON.stringify({
              src: m_pushTable,
              where: filters,
              title: title,
              message: message
          }));

          request.end();
      });
  };

  this.prepare = function( prepare ){

    if( typeof prepare == 'function' ){
      prepare(m_query);
    }

    return new Promise(function (resolve, reject) {

      var headers = getHeaders();

      var options = {
        hostname: m_hostname,
        path: m_rootpath + m_query.getPath(),
        method: m_query.getType().toUpperCase(),
        headers: headers
      };

      var request = http.request(options, function (res) {

        res.setEncoding('utf8');
        res.on('data', function(data){

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
  configure: function( url, apiKey, pushTable ){

    if( pushTable==undefined )
      pushTable = "devices:token";

    sharedManager = new FastApiManager( url, apiKey, pushTable );

    var currentUser = this.stored('current-user');

    if( currentUser ){

      this.login(currentUser);
    }
  },
  login: function( object ){

    sharedManager.login(object);
    this.store('current-user', object);
  },
  uploadUrl: function(){

    return sharedManager.getUploadUrl();
  },
  user: function(){

    return sharedManager.currentUser();
  },
  logout: function(){

    sharedManager.logout();
    this.store('current-user', null);
  },
  push: function( title, message, filters ){

    return sharedManager.push(title, message, filters);
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
  insert: function( object, data ){

    if( data==undefined ){

      var query = new FastApiQuery( 'put', object.getType() );
      query.setData(object.json());
      return sharedManager.init(query).prepare();

    } else {

      var query = new FastApiQuery('put', object);
      var rows = [];
      for( var i=0; i<data.length; i++ ){
        rows.push(data[i].json());
      }
      query.setData(rows);
      return sharedManager.init(query).prepare();
    }
  },
  store: function(key, data){

    if( localStorage ){

      if( data!=null ){

        if( typeof data=="object" && data.isDataObject ){

          var type = data.getType();
          data = data.json(true);
          data.__type = type;
        }

        localStorage.setItem('fast-api-'+key, JSON.stringify(data));

      } else {

        localStorage.removeItem('fast-api-'+key);
      }
    }
  },
  stored: function (key) {

    if( localStorage ){

      try {

        var value = localStorage.getItem('fast-api-'+key);
        if( value ){
          var data = JSON.parse(value);

          if( typeof data=="object" && data.__type ){

            return new DataObject(data);

          } else {

            return data;
          }
        }

      } catch (e) {

      }
    }

    return null;
  }
};
