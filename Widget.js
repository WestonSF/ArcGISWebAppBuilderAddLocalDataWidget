///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
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
    "dojo/Deferred",
    "dojo/dom-class",
    "dojo/_base/lang",
    "dojo/_base/html",
    "dojo/dom",
    "dojo/json",
    "dojo/on",
    "dojo/sniff",
    "dojo/_base/array",
    "dojo/string",
    "dojox/data/CsvStore",
    "dijit/_WidgetsInTemplateMixin",
    "jimu/tokenUtils",
    "jimu/BaseWidget",
    "jimu/utils",
    "jimu/dijit/Message",
    "jimu/dijit/SymbolChooser",
    "jimu/dijit/TabContainer",
    "jimu/dijit/ViewStack",
    "jimu/dijit/LoadingIndicator",
    "esri/InfoTemplate",
    "esri/geometry/scaleUtils",
    "esri/layers/FeatureLayer",
    "esri/Color",
    "esri/renderers/SimpleRenderer",
    "esri/symbols/PictureMarkerSymbol",
    "esri/symbols/SimpleFillSymbol",
    "esri/symbols/SimpleLineSymbol",
    "esri/geometry/webMercatorUtils",
    "esri/request"
  ],
  function (declare,
      Deferred,
      domClass,
      lang,
      html,
      dom,
      JSON,
      on,
      sniff,
      arrayUtils,
      string,
      CsvStore,
      _WidgetsInTemplateMixin,
      tokenUtils,
      BaseWidget,
      utils,
      Message,
      SymbolChooser,
      TabContainer,
      ViewStack,
      LoadingIndicator,
      InfoTemplate,
      scaleUtils,
      FeatureLayer,
      Color,
      SimpleRenderer,
      PictureMarkerSymbol,
      SimpleFillSymbol,
      SimpleLineSymbol,
      webMercatorUtils,
      request)
    {
      // Base widget
    return declare([BaseWidget, _WidgetsInTemplateMixin], {
      name: "AddLocalData",
      baseClass: "jimu-widget-add-local-data",
      layersAdded: [],

      // EVENT FUNCTION - Creation of widget
      postCreate: function () {
          console.log('Add Local Data widget created...');

          // Setup tabs
          var tabs = [];
          tabs.push({
              title: this.nls.addData,
              content: this.addDataTab
          });
          tabs.push({
              title: this.nls.symbology,
              content: this.symbologyTab
          });
          this.selTab = this.nls.addData;
          this.tabContainer = new TabContainer({
              tabs: tabs,
              selected: this.selTab
          }, this.addLocalDataWidget);
          this.tabContainer.startup();
          utils.setVerticalCenter(this.tabContainer.domNode);

          // Setup the view for symbology chooser
          this.viewStack = new ViewStack({
              viewType: 'dom',
              views: [this.pointSection, this.lineSection, this.polygonSection]
          });
          html.place(this.viewStack.domNode, this.setSymbology);

          // Load in data types to selection
          var len = this.config.dataTypes.length;
          for (var a = 0; a < len; a++) {
              var option = {
                  value: this.config.dataTypes[a].label,
                  label: this.config.dataTypes[a].label + " (" + this.config.dataTypes[a].fileExtension + ")"
              };
              this.dataTypeSelect.addOption(option);
          }

          // Load in geomtery types to selection
          var len = this.config.geometryTypes.length;
          for (var a = 0; a < len; a++) {
              var option = {
                  value: this.config.geometryTypes[a].type,
                  label: this.config.geometryTypes[a].type
              };
              this.geometryTypeSelect.addOption(option);
          }

          // Load in coordinate systems to selection
          var len = this.config.coordinateSystems.length;
          for (var a = 0; a < len; a++) {
              var option = {
                  value: this.config.coordinateSystems[a].wkid,
                  label: this.config.coordinateSystems[a].label
              };
              this.coordSystemSelect.addOption(option);
          }
      },

      // EVENT FUNCTION - Startup of widget
      startup: function () {
         console.log('Add Local Data widget started...');
         var mapFrame = this;

         // Startup the view for symbology chooser
         mapFrame.viewStack.startup();
         mapFrame.viewStack.switchView(null);
         layersAdded = [];
         // Initially disable clear button
         domClass.add(this.clearButton, 'jimu-state-disabled');

         // Hide coordinate system selection if only one option present
         var len = this.config.coordinateSystems.length;
         if (len < 2) {
             dojo.style(dojo.byId("coordSystem"), "display", "none");
         }

         // Hide geometry selection if only one option present
         var len = this.config.geometryTypes.length;
         if (len < 2) {
             dojo.style(dojo.byId("geometryType"), "display", "none");
         }

        // Attach event function for data type change
         on(dijit.byId("dataTypeSelect"), "change", function (event) {
             // Check the data type
             dataTypeCheck();
             // Check the geometry type
             geometryTypeCheck();
        });
          // Check the data type
         dataTypeCheck();

          // Attach event function for geometry type change
         on(dijit.byId("geometryTypeSelect"), "change", function (event) {
             // Check the geometry type
             geometryTypeCheck();
         });
          // Check the geometry type
         geometryTypeCheck();

        // EVENT FUNCTION - On file selection
        on(dom.byId("uploadForm"), "change", function (event) {
            var fileName = event.target.value.toLowerCase();

            // Filename is full path in IE so extract the file name
            if (sniff("ie")) { 
                var arr = fileName.split("\\");
                fileName = arr[arr.length - 1];
            }
            // If a .csv,.zip,.gpx or .geojson file
            if ((fileName.toLowerCase().indexOf(".csv") !== -1) || (fileName.toLowerCase().indexOf(".zip") !== -1) || (fileName.toLowerCase().indexOf(".gpx") !== -1) || (fileName.toLowerCase().indexOf(".geojson") !== -1)) {
                if (fileName.toLowerCase().indexOf(".csv") !== -1) {
                    // Check file type is in the configuration
                    var fileSelection = "false";
                    var len = mapFrame.config.dataTypes.length;
                    for (var a = 0; a < len; a++) {
                        if (mapFrame.config.dataTypes[a].fileExtension.toLowerCase() == ".csv") {
                            var fileSelection = "true";
                        }
                    }
                    if (fileSelection == "true") {
                        // Generate feature collection from the file uploaded
                        checkCSV(fileName);
                    }
                        // If not a valid file
                    else {
                        // Show error message
                        showError(mapFrame.nls.notValidFileError);
                    }
                }
                if (fileName.toLowerCase().indexOf(".zip") !== -1) {
                    // Check file type is in the configuration
                    var fileSelection = "false";
                    var len = mapFrame.config.dataTypes.length;
                    for (var a = 0; a < len; a++) {
                        if (mapFrame.config.dataTypes[a].fileExtension.toLowerCase() == ".zip") {
                            var fileSelection = "true";
                        }
                    }
                    if (fileSelection == "true") {
                        // Generate feature collection from the file uploaded
                        generateFeatureCollectionFromShapefile(fileName);
                    }
                        // If not a valid file
                    else {
                        // Show error message
                        showError(mapFrame.nls.notValidFileError);
                    }
                }
                if (fileName.toLowerCase().indexOf(".gpx") !== -1) {
                    // Check file type is in the configuration
                    var fileSelection = "false";
                    var len = mapFrame.config.dataTypes.length;
                    for (var a = 0; a < len; a++) {
                        if (mapFrame.config.dataTypes[a].fileExtension.toLowerCase() == ".gpx") {
                            var fileSelection = "true";
                        }
                    }
                    if (fileSelection == "true") {
                        // Generate feature collection from the file uploaded
                        generateFeatureCollectionFromGPX(fileName);
                    }
                        // If not a valid file
                    else {
                        // Show error message
                        showError(mapFrame.nls.notValidFileError);
                    }
                }
                if (fileName.toLowerCase().indexOf(".geojson") !== -1) {
                    // Check file type is in the configuration
                    var fileSelection = "false";
                    var len = mapFrame.config.dataTypes.length;
                    for (var a = 0; a < len; a++) {
                        if (mapFrame.config.dataTypes[a].fileExtension.toLowerCase() == ".geojson") {
                            var fileSelection = "true";
                        }
                    }
                    if (fileSelection == "true") {
                        // Generate feature collection from the file uploaded
                        generateFeatureCollectionFromGeoJSON(fileName);
                    }
                        // If not a valid file
                    else {
                        // Show error message
                        showError(mapFrame.nls.notValidFileError);
                    }
                }
            }
            // If not a valid file
            else {
                // Show error message
                showError(mapFrame.nls.notValidFileError);
            }
        });

        // FUNCTION - Data type check
        function dataTypeCheck() {
            dataType = mapFrame.dataTypeSelect.value.toLowerCase();
            // If data type is CSV
            if (dataType == "csv") {
                // Show csv parameters
                dojo.style(dojo.byId("csvTable"), "display", "block");
                dojo.style(dojo.byId("csvLinePolygonFieldTable"), "display", "block");
            }
            else {
                // Hide csv parameters
                dojo.style(dojo.byId("csvTable"), "display", "none");
                dojo.style(dojo.byId("csvLinePolygonFieldTable"), "display", "none");
            }
        }

          // FUNCTION - Geometry type check
        function geometryTypeCheck() {
            dataType = mapFrame.dataTypeSelect.value.toLowerCase();
            geometryType = mapFrame.geometryTypeSelect.value.toLowerCase();
            // If geometry type is line or polygon
            if (((geometryType == "line") || (geometryType == "polygon")) && (dataType == "csv")) {
                // Show line/polygon parameter
                dojo.style(dojo.byId("csvLinePolygonFieldTable"), "display", "block");
            }
            else {
                // Hide line/polygon parameter
                dojo.style(dojo.byId("csvLinePolygonFieldTable"), "display", "none");
            }
        }

        // FUNCTION - Check the CSV file
        function checkCSV(fileName) {
            console.log("Processing the CSV...")
            // If not populated X and Y fields
            if ((fileName.toLowerCase().indexOf(".csv") !== -1) && (mapFrame.xCoordTextBox.get('value') == null || mapFrame.xCoordTextBox.get('value').trim() == "" || mapFrame.yCoordTextBox.get('value') == null || mapFrame.yCoordTextBox.get('value').trim() == "")) {
                // Show error message
                showError(mapFrame.nls.noXYFieldsError);
            }
            // X and Y fields populated
            else {
                // If geometry type is line or polygon and field not populated
                if (((geometryType == "line") || (geometryType == "polygon")) && (mapFrame.linePolygonFieldTextBox.get('value') == null || mapFrame.linePolygonFieldTextBox.get('value').trim() == "")) {
                    // Show error message
                    showError(mapFrame.nls.noLinePolygonError);
                }
                else {
                    var name = fileName.split(".");
                    // Chrome and IE add c:\fakepath to the value - we need to remove it
                    name = name[0].replace("c:\\fakepath\\", "");

                    // Show loading
                    mapFrame.loading.show();

                    var csvDelimiter;
                    var csvFields;
                    // Read the CSV file
                    file = mapFrame.inFile.files[0];
                    if (utils.file.supportHTML5()) {
                        var reader = new FileReader();
                        reader.onload = lang.hitch(this, function () {
                            // Generate feature collection from the CSV data  
                            generateFeatureCollectionFromCSV(reader.result,name);
                        });
                        reader.readAsText(file);
                    } else if (utils.file.supportFileAPI()) {
                        window.FileAPI.readAsText(file, lang.hitch(this, function (evt) {
                            // Generate feature collection from the CSV data  
                            generateFeatureCollectionFromCSV(evt.result,name);
                        }));
                    } else {
                        showError(mapFrame.nls.noFileHandlereSupport);
                    }
                }
            }
        }

        // FUNCTION - Generate feature collection from csv
        function generateFeatureCollectionFromCSV(data,name) {
            console.log("Creating features from the CSV...")
            // Get the column delimiter from the CSV file
            var newLineIndex = data.indexOf('\n');
            var firstLine = lang.trim(data.substr(0, newLineIndex));
            var separators = [',', '      ', ';', '|'];
            var maxSeparatorLength = 0;
            var columnDelimiter = '';
            arrayUtils.forEach(separators, function (separator) {
                var length = firstLine.split(separator).length;
                if (length > maxSeparatorLength) {
                    maxSeparatorLength = length;
                    columnDelimiter = separator;
                }
            });

            // Setup the csv store
            var csvStore = new CsvStore({
                data: data,
                separator: columnDelimiter
            });
            // Get the data from the CSV store
            csvStore.fetch({
                onComplete: lang.hitch(this, function (items) {
                    // Get all the fields from the CSV file
                    fields = csvStore.getAttributes(items[0]);
                    layerFields = [];
                    // Go through each of the fields and populate the field info
                    fields.forEach(function (field) {
                        var fieldInfo = {}
                        fieldInfo['name'] = field;
                        fieldInfo['alias'] = field;
                        layerFields.push(fieldInfo);
                    });
                    // Define the input parameters for generate features
                    var params = {
                        'name': name,
                        'targetSR': mapFrame.map.spatialReference,
                        'maxRecordCount': 10000,
                        'locationType': "coordinates",
                        'longitudeFieldName': mapFrame.xCoordTextBox.get('value'),
                        'latitudeFieldName': mapFrame.yCoordTextBox.get('value'),
                        'columnDelimiter': columnDelimiter,
                        'layerInfo': {
                            "type": "Feature Layer",
                            "geometryType": "esriGeometryPoint",
                            "fields": layerFields
                        },
                        'enforceInputFileSizeLimit': true,
                        'enforceOutputJsonSizeLimit': true
                    };

                    var myContent = {
                        'filetype': "csv",
                        'publishParameters': JSON.stringify(params),
                        'f': 'json',
                        'callback.html': 'textarea'
                    };

                    // Use the rest generate operation to generate a feature collection from the zipped shapefile
                    request({
                        url: mapFrame.config.portalURL + "/sharing/rest/content/features/generate",
                        content: myContent,
                        form: dom.byId("uploadForm"),
                        handleAs: "json",
                        load: lang.hitch(this, function (response) {
                            if (response.error) {
                                showError(response.error);
                            }
                            if (response.featureCollection.layers[0].featureSet.features.length > 0) {
                                console.log("Features returned from query to " + mapFrame.config.portalURL + "/sharing/rest/content/features/generate...")
                                console.log(response.featureCollection)
                                // If valid geometry
                                if (response.featureCollection.layers[0].featureSet.features[0].geometry != null) {
                                    // If geometry type is line or polygon
                                    if (((geometryType == "line") || (geometryType == "polygon")) && (dataType == "csv")) {
                                        // Generate line/polygon feature collection
                                        pointsToLinePolygon(response.featureCollection,name);
                                    }
                                    // If point
                                    else {
                                        // Add the feature collection to the map
                                        addFeaturesToMap(response.featureCollection,name);
                                    }
                                }
                                else {
                                    // Show error message
                                    showError(mapFrame.nls.noValidFeaturesError);
                                }
                            }
                            else {
                                // Show error message
                                showError(mapFrame.nls.noFeaturesError);
                            }
                        }),
                        error: lang.hitch(this, showError)
                    });
                }),
                onError: lang.hitch(this, function (error) {
                    // Show error
                    var msg = string.substitute(mapFrame.nls.readingCSVError, {
                        0: error.message
                    });
                    showError(msg);
                })
            });
        }

        // FUNCTION - Generate feature collection from shapefile
        function generateFeatureCollectionFromShapefile(fileName) {
            console.log("Creating features from the shapefile...")
            var name = fileName.split(".");
            // Chrome and IE add c:\fakepath to the value - we need to remove it
            name = name[0].replace("c:\\fakepath\\", "");

            // Show loading
            mapFrame.loading.show();

            // Define the input parameters for generate features
            var params = {
                'name': name,
                'targetSR': mapFrame.map.spatialReference,
                'maxRecordCount': 10000,
                'enforceInputFileSizeLimit': true,
                'enforceOutputJsonSizeLimit': true
            };

            // Generalize features for display
            var extent = scaleUtils.getExtentForScale(mapFrame.map, 40000);
            var resolution = extent.getWidth() / mapFrame.map.width;
            params.generalize = true;
            params.maxAllowableOffset = resolution;
            params.reducePrecision = true;
            params.numberOfDigitsAfterDecimal = 0;

            var myContent = {
                'filetype': "shapefile",
                'publishParameters': JSON.stringify(params),
                'f': 'json',
                'callback.html': 'textarea'
            };

            // Use the rest generate operation to generate a feature collection from the zipped shapefile
            request({
                url: mapFrame.config.portalURL + '/sharing/rest/content/features/generate',
                content: myContent,
                form: dom.byId('uploadForm'),
                handleAs: 'json',
                load: lang.hitch(this, function (response) {
                    if (response.error) {
                        showError(response.error);
                    }
                    // Add the feature collection to the map
                    addFeaturesToMap(response.featureCollection,name);
                }),
                error: lang.hitch(this, showError)
            });
        }

          // FUNCTION - Generate feature collection from GPX
        function generateFeatureCollectionFromGPX(fileName) {
            console.log("Creating features from the GPX...")
            var name = fileName.split(".");
            // Chrome and IE add c:\fakepath to the value - we need to remove it
            name = name[0].replace("c:\\fakepath\\", "");
            // Show loading
            mapFrame.loading.show();

            // Define the input parameters for generate features
            var params = {
                'name': name,
                'targetSR': mapFrame.map.spatialReference,
                'maxRecordCount': 10000,
                'enforceInputFileSizeLimit': true,
                'enforceOutputJsonSizeLimit': true
            };

            // Generalize features for display
            var extent = scaleUtils.getExtentForScale(mapFrame.map, 40000);
            var resolution = extent.getWidth() / mapFrame.map.width;
            params.generalize = true;
            params.maxAllowableOffset = resolution;
            params.reducePrecision = true;
            params.numberOfDigitsAfterDecimal = 0;

            var myContent = {
                'filetype': "gpx",
                'publishParameters': JSON.stringify(params),
                'f': 'json',
                'callback.html': 'textarea'
            };

            // Use the rest generate operation to generate a feature collection from the zipped shapefile
            request({
                url: mapFrame.config.portalURL + '/sharing/rest/content/features/generate',
                content: myContent,
                form: dom.byId('uploadForm'),
                handleAs: 'json',
                load: lang.hitch(this, function (response) {
                    if (response.error) {
                        showError(response.error);
                    }
                    // Add the feature collection to the map
                    addFeaturesToMap(response.featureCollection,name);
                }),
                error: lang.hitch(this, showError)
            });
        }

        // FUNCTION - Generate feature collection from GeoJSON - If basemap is in spatial reference of 102100 only
        function generateFeatureCollectionFromGeoJSON(fileName) {
            console.log("Creating features from the GeoJSON...")
            var name = fileName.split(".");
            // Chrome and IE add c:\fakepath to the value - we need to remove it
            name = name[0].replace("c:\\fakepath\\", "");

            // Show loading
            mapFrame.loading.show();

            // Define the input parameters for generate features
            var params = {
                'name': name,
                // Only does 102100 - 'targetSR': mapFrame.map.spatialReference,
                'maxRecordCount': 10000,
                'enforceInputFileSizeLimit': true,
                'enforceOutputJsonSizeLimit': true
            };

            // Generalize features for display
            var extent = scaleUtils.getExtentForScale(mapFrame.map, 40000);
            var resolution = extent.getWidth() / mapFrame.map.width;
            params.generalize = true;
            params.maxAllowableOffset = resolution;
            params.reducePrecision = true;
            params.numberOfDigitsAfterDecimal = 0;

            var myContent = {
                'filetype': "geojson",
                'publishParameters': JSON.stringify(params),
                'f': 'json',
                'callback.html': 'textarea'
            };

            // Use the rest generate operation to generate a feature collection from the GeoJSON file
            request({
                url: mapFrame.config.portalURL + '/sharing/rest/content/features/generate',
                content: myContent,
                form: dom.byId('uploadForm'),
                handleAs: 'json',
                load: lang.hitch(this, function (response) {
                    if (response.error) {
                        showError(response.error);
                    }
                    // Add the feature collection to the map
                    addFeaturesToMap(response.featureCollection,name);
                }),
                error: lang.hitch(this, showError)
            });
        }

        // FUNCTION - Generate lines/polygons from points feature collection
        function pointsToLinePolygon(featureCollection,name) {
            var geometryType = mapFrame.geometryTypeSelect.value.toLowerCase();
            var linePolygonField = mapFrame.linePolygonFieldTextBox.get('value');
            var linePolygonFeatures = [];
            // For each of the layers
            arrayUtils.forEach(featureCollection.layers, function (layer) {
                // For each object in the layer - Create new object with unique Id specified
                arrayUtils.forEach(layer.featureSet.features, function (feature) {
                    var id = feature.attributes[linePolygonField]
                    var added = "false";
                    // For each object in the line features object
                    arrayUtils.forEach(linePolygonFeatures, function (lineFeature) {
                        // If feature already added to the object
                        if (lineFeature.id == id) {
                            added = "true";
                        }
                    });

                    // If feature not added to the object, add a new object
                    if (added == "false") {
                        featureObject = {};
                        featureObject["id"] = id
                        featureObject["points"] = []
                        featureObject["points"].push(feature.geometry.x + "," + feature.geometry.y)
                        featureObject["attributes"] = feature.attributes
                        linePolygonFeatures.push(featureObject);
                    }
                    // Otherwise add to an existing object
                    else {
                        featureObject["points"].push(feature.geometry.x + "," + feature.geometry.y)
                    }
                });
            });

            var linePolygonFeaturesNew = [];

            // If geometry is polygon
            if (geometryType == "polygon") {
                console.log("Creating polygon features from the CSV...")
                // For each of the polygon features - Create new geometry polygon features
                arrayUtils.forEach(linePolygonFeatures, function (polygonFeature) {
                    var featureObject = {};
                    featureObject["attributes"] = polygonFeature.attributes;
                    var polygon = new esri.geometry.Polygon(mapFrame.map.spatialReference);
                    polygon.type = "polygon";
                    featureObject["geometry"] = polygon
                    // For each of the points that make up the line feature
                    var fullPolygon = [];
                    arrayUtils.forEach(polygonFeature.points, function (point) {
                        var polygonPath = [];
                        var pointSplit = point.split(",");
                        polygonPath[0] = parseFloat(pointSplit[0]);
                        polygonPath[1] = parseFloat(pointSplit[1]);
                        fullPolygon.push(polygonPath)
                    });
                    polygon.addRing(fullPolygon);
                    linePolygonFeaturesNew.push(featureObject);
                });
                // Update the feature collection with the geometry type
                featureCollection.layers[0].featureSet.geometryType = "esriGeometryPolygon";
                featureCollection.layers[0].layerDefinition.geometryType = "esriGeometryPolygon";
            }
            // If geometry is line
            else {
                console.log("Creating line features from the CSV...")
                // For each of the line features - Create new geometry line features
                arrayUtils.forEach(linePolygonFeatures, function (lineFeature) {
                    var featureObject = {};
                    featureObject["attributes"] = lineFeature.attributes;
                    var polyline = new esri.geometry.Polyline(mapFrame.map.spatialReference);
                    polyline.type = "polyline";
                    featureObject["geometry"] = polyline
                    // For each of the points that make up the line feature
                    var fullLine = [];
                    arrayUtils.forEach(lineFeature.points, function (point) {
                        var linePath = [];
                        var pointSplit = point.split(",");
                        linePath[0] = parseFloat(pointSplit[0]);
                        linePath[1] = parseFloat(pointSplit[1]);
                        fullLine.push(linePath)
                    });
                    polyline.addPath(fullLine);
                    linePolygonFeaturesNew.push(featureObject);
                });
                // Update the feature collection with the geometry type
                featureCollection.layers[0].featureSet.geometryType = "esriGeometryPolyline";
                featureCollection.layers[0].layerDefinition.geometryType = "esriGeometryPolyline";
            }
            // Update the feature collection with new line features
            featureCollection.layers[0].featureSet.features = linePolygonFeaturesNew;
            
            // Add the feature collection to the map
            addFeaturesToMap(featureCollection,name);
        }

        // FUNCTION - Add features to map
        function addFeaturesToMap(featureCollection,name) {
            console.log("Adding features to the map...")
            var fullExtent;
            var layers = [];
            arrayUtils.forEach(featureCollection.layers, function (layer) {
                var infoTemplate = new InfoTemplate("Details", "${*}");
                var featureLayer = new FeatureLayer(layer, {
                    infoTemplate: infoTemplate
                });
                featureLayer.type = "Feature Layer";
                // Add name of layer in proper text
                featureLayer.name = name.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
                // Associate the feature with the popup on click to enable highlight and zoom to
                featureLayer.on('click', function (event) {
                    mapFrame.map.infoWindow.setFeatures([event.graphic]);
                });
                fullExtent = fullExtent ?
                  fullExtent.union(featureLayer.fullExtent) : featureLayer.fullExtent;
                layers.push(featureLayer);
            });
                
            // Add to global array
            layersAdded.push(layers);
            // Add layer to map
            mapFrame.map.addLayers(layers);
            // Zoom to extent of layer
            mapFrame.map.setExtent(fullExtent.expand(1.25), true);

            // Set the symbology
            var geometryAdded;
            arrayUtils.forEach(layers, function (layer) {
                changeSymbology(layer);
                // Get the geometry of the layer
                geometryAdded = layer.geometryType;
            });

            // Enable clear button
            domClass.remove(mapFrame.clearButton, 'jimu-state-disabled');
            // Hide loading
            mapFrame.loading.hide();

            // Update the symbol chooser
            if (geometryAdded == 'esriGeometryPolygon') {
                mapFrame.viewStack.switchView(mapFrame.polygonSection);
            } else if (geometryAdded == 'esriGeometryPolyline') {
                mapFrame.viewStack.switchView(mapFrame.lineSection);
            } else {
                mapFrame.viewStack.switchView(mapFrame.pointSection);
            }
        }

        // FUNCTION - Change the symbology
        function changeSymbology(layer) {
            //change the default symbol for the feature collection for polygons and points
            var symbol = null;
            switch (layer.geometryType) {
                case 'esriGeometryPolygon':
                    // Get the symbology set from the symbol chooser for polygons
                    symbol = mapFrame.fillSymChooser.getSymbol();
                    break;
                case 'esriGeometryPolyline':
                    // Get the symbology set from the symbol chooser for lines
                    symbol = mapFrame.lineSymChooser.getSymbol();
                    break;
                default:
                    // Get the symbology set from the symbol chooser for points
                    symbol = mapFrame.pointSymChooser.getSymbol();
                    break;
            }
            if (symbol) {
                layer.setRenderer(new SimpleRenderer(symbol));
                layer.refresh()
            }
        }

        // EVENT FUNCTION - Point symbology change
        on(this.pointSymChooser, 'change', function (newSymbol) {
            // For each of the set of layers added to the map (For last layer added)
            arrayUtils.forEach(layersAdded[layersAdded.length - 1], function (layer) {
                changeSymbology(layer);
            });
        });

        // EVENT FUNCTION - Line symbology change
        on(this.lineSymChooser, 'change', function (newSymbol) {
            // For each of the set of layers added to the map (For last layer added)
            arrayUtils.forEach(layersAdded[layersAdded.length - 1], function (layer) {
                changeSymbology(layer);
            });
        });

        // EVENT FUNCTION - Polygon symbology change
        on(this.fillSymChooser, 'change', function (newSymbol) {
            // For each of the set of layers added to the map (For last layer added)
            arrayUtils.forEach(layersAdded[layersAdded.length - 1], function (layer) {
                changeSymbology(layer);
            });
        });

        // EVENT FUNCTION - Clear button click
        on(this.clearButton, 'click', lang.hitch(this, function (evt) {
            // Hide the view for symbology chooser
            mapFrame.viewStack.switchView(null);

            // Close info window
            mapFrame.map.infoWindow.hide();
            // Clear existing layers
            arrayUtils.forEach(layersAdded, function (layers) {
                arrayUtils.forEach(layers, function (layer) {
                    mapFrame.map.removeLayer(layer);
                });
            });

            // Disable clear button
            domClass.add(mapFrame.clearButton, 'jimu-state-disabled');
        }));

        // FUNCTION - Error handler
        function showError(errorMessage) {
            // Hide loading
            mapFrame.loading.hide();
            // Hide the view for symbology chooser
            mapFrame.viewStack.switchView(null);
            // Show error message
            new Message({
                type: 'error',
                message: String(errorMessage)
            });
        }
      },

      // EVENT FUNCTION - Open widget
      onOpen: function () {
        console.log('Add Local Data widget opened...');
      },

      // EVENT FUNCTION - Close widget
      onClose: function() {
        console.log('Add Local Data widget closed...');
      },

      // EVENT FUNCTION - Minimise widget
      onMinimize: function () {
        console.log('Add Local Data widget minimised...');
      }
    });

  });
