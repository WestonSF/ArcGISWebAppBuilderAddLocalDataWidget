///////////////////////////////////////////////////////////////////////////
// Copyright © 2015 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define(["dojo/_base/declare",
    "dojo/_base/lang",
    "jimu/BaseWidgetSetting",
    "jimu/dijit/SimpleTable",
    "dijit/_WidgetsInTemplateMixin",
  ],
  function (declare,
      lang,
      BaseWidgetSetting,
      Table,
      _WidgetsInTemplateMixin)
  {

    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {

      baseClass: "jimu-widget-add-local-data-setting",

      // EVENT FUNCTION - Creation of widget
      postCreate: function() {
        this.inherited(arguments);
      },

      // EVENT FUNCTION - Startup of widget
      startup: function() {
          // Set the default configuration parameters from the config file
          this.setConfig(this.config);
      },

      // FUNCTION - Set the default configuration parameters in the configure widget from the config file
      setConfig: function (config) {
          // Set the description
          this.description.set('value', this.config.description);

          // Set the portal URL
          this.portalURL.set('value', this.config.portalURL);

          // Setup the coordinates table
          var fields = [{
              name: 'label',
              title: this.nls.coordinateSystem,
              type: 'text',

              unique: false,
              editable: false
          }, {
              name: 'wkid',
              title: this.nls.spatialReference,
              type: 'text',
              unique: false,
              editable: false
          }, {
              name: 'xmin',
              title: "XMin",
              type: 'text',
              unique: false,
              editable: false
          }, {
              name: 'xmax',
              title: "XMax",
              type: 'text',
              unique: false,
              editable: false
          }, {
              name: 'ymin',
              title: "YMin",
              type: 'text',
              unique: false,
              editable: false
          }, {
              name: 'ymax',
              title: "YMax",
              type: 'text',
              unique: false,
              editable: false
          },
        {
            name: '',
            title: '',
            width: '100px',
            type: 'actions',
            actions: ['up', 'down', 'delete']
        }
          ];
          var args = {
              fields: fields,
              selectable: false
          };
          this.CoordTable = new Table(args);
          this.CoordTable.autoHeight = true;
          this.CoordTable.placeAt(this.coordSystemsTable);
          this.CoordTable.startup();

          // Load in coordinate systems
          if (this.config.coordinateSystems.length > 0) {
              var json = [];
              var len = this.config.coordinateSystems.length;
              for (var a = 0; a < len; a++) {
                  json.push({
                      label: this.config.coordinateSystems[a].label,
                      wkid: this.config.coordinateSystems[a].wkid,
                      xmin: this.config.coordinateSystems[a].xmin,
                      xmax: this.config.coordinateSystems[a].xmax,
                      ymin: this.config.coordinateSystems[a].ymin,
                      ymax: this.config.coordinateSystems[a].ymax
                  });
              }
              this.CoordTable.addRows(json);
          }

          // Setup the data types table
          var fields = [{
              name: 'label',
              title: this.nls.dataType,
              type: 'text',

              unique: false,
              editable: false
          }, {
              name: 'fileExtension',
              title: this.nls.fileExtension,
              type: 'text',
              unique: false,
              editable: false
          },
          {
              name: '',
              title: '',
              width: '100px',
              type: 'actions',
              actions: ['up', 'down', 'delete']
          }
          ];
          var args = {
              fields: fields,
              selectable: false
          };
          this.dataTable = new Table(args);
          this.dataTable.autoHeight = true;
          this.dataTable.placeAt(this.dataTypesTable);
          this.dataTable.startup();

          // Load in data types
          if (this.config.dataTypes.length > 0) {
              var json = [];
              var len = this.config.dataTypes.length;
              for (var a = 0; a < len; a++) {
                  json.push({
                      label: this.config.dataTypes[a].label,
                      fileExtension: this.config.dataTypes[a].fileExtension,
                  });
              }
              this.dataTable.addRows(json);
          }
      },

      // FUNCTION - Get the configuration parameters from the configure widget and load into configuration file
      getConfig: function() {
          // Get the description
          this.config.description = this.description.get('value');

          // Get the portal URL
          this.config.portalURL = this.portalURL.get('value');

          // Get the data types
          var data = this.dataTable.getData();
          var json = [];
          var len = data.length;
          for (var i = 0; i < len; i++) {
              json.push(data[i]);
          }
          this.config.dataTypes = json;

          // Get the coordinate systems
          var data = this.CoordTable.getData();
          var json = [];
          var len = data.length;
          for (var i = 0; i < len; i++) {
              json.push(data[i]);
          }
          this.config.coordinateSystems = json;

          // Return the configuration parameters
          return this.config;
      }

    });

  });
