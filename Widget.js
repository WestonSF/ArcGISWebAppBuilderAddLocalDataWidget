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

          // Setup the view for symbology chooser
          this.viewStack = new ViewStack({
              viewType: 'dom',
              views: [this.pointSection, this.lineSection, this.polygonSection]
          });
          html.place(this.viewStack.domNode, this.setSymbology);

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

        // EVENT FUNCTION - On file selection
        on(dom.byId("uploadForm"), "change", function (event) {
            var fileName = event.target.value.toLowerCase();

            // Filename is full path in IE so extract the file name
            if (sniff("ie")) { 
                var arr = fileName.split("\\");
                fileName = arr[arr.length - 1];
            }
            // If a .csv or .zip file
            if ((fileName.toLowerCase().indexOf(".csv") !== -1) || (fileName.toLowerCase().indexOf(".zip") !== -1)) {
                if (fileName.toLowerCase().indexOf(".csv") !== -1) {
                    // Generate feature collection from the file uploaded
                    checkCSV(fileName);
                }
                if (fileName.toLowerCase().indexOf(".zip") !== -1) {
                    // Generate feature collection from the file uploaded
                    generateFeatureCollectionFromShapefile(fileName);
                }
            }
            // If not a valid file
            else {
                // Show error message
                showError(mapFrame.nls.notValidFileError);
            }
        });

        // FUNCTION - Check the CSV file
        function checkCSV(fileName) {
            // If not populated X and Y fields
            if ((fileName.toLowerCase().indexOf(".csv") !== -1) && (mapFrame.xCoordTextBox.get('value') == null || mapFrame.xCoordTextBox.get('value').trim() == "" || mapFrame.yCoordTextBox.get('value') == null || mapFrame.yCoordTextBox.get('value').trim() == "")) {
                // Show error message
                showError(mapFrame.nls.noXYFieldsError);
            }
                // X and Y fields populated
            else {
                var name = fileName.split(".");
                // Chrome and IE add c:\fakepath to the value - we need to remove it
                name = name[0].replace("c:\\fakepath\\", "");

                // Show loading
                mapFrame.loading.show();

                var csvDelimiter;
                var csvFields;
                // Read the CSV file
                file = this.inFile.files[0];
                if (utils.file.supportHTML5()) {
                    var reader = new FileReader();
                    reader.onload = lang.hitch(this, function () {
                        // Generate feature collection from the CSV data  
                        generateFeatureCollectionFromCSV(reader.result);
                    });
                    reader.readAsText(file);
                } else if (utils.file.supportFileAPI()) {
                    window.FileAPI.readAsText(file, lang.hitch(this, function (evt) {
                        // Generate feature collection from the CSV data  
                        generateFeatureCollectionFromCSV(evt.result);
                    }));
                } else {
                    showError(mapFrame.nls.noFileHandlereSupport);
                }
            }
        }

        // FUNCTION - Generate feature collection from csv
        function generateFeatureCollectionFromCSV(data) {
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
                        'sourceSR': { "wkid": mapFrame.coordSystemSelect.value },
                        'targetSR': mapFrame.map.spatialReference,
                        'maxRecordCount': 10000,
                        'locationType': "coordinates",
                        'longitudeFieldName': mapFrame.xCoordTextBox.get('value'),
                        'latitudeFieldName': mapFrame.yCoordTextBox.get('value'),
                        'columnDelimiter': columnDelimiter,
                        'layerInfo': {
                            "geometryType": "esriGeometryPoint",
                            "type": "Feature Layer",
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
                        url: mapFrame.config.portalURL + '/sharing/rest/content/features/generate',
                        content: myContent,
                        form: dom.byId('uploadForm'),
                        handleAs: 'json',
                        load: lang.hitch(this, function (response) {
                            if (response.error) {
                                showError(response.error);
                            }
                            if (response.featureCollection.layers[0].featureSet.features.length > 0) {
                                // If valid geometry
                                if (response.featureCollection.layers[0].featureSet.features[0].geometry != null) {
                                    addFeaturesToMap(response.featureCollection);
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
                    addFeaturesToMap(response.featureCollection);
                }),
                error: lang.hitch(this, showError)
            });
        }

        // FUNCTION - Add features to map
        function addFeaturesToMap(featureCollection) {
            var fullExtent;
            var layers = [];
  
            arrayUtils.forEach(featureCollection.layers, function (layer) {
                var infoTemplate = new InfoTemplate("Details", "${*}");
                var featureLayer = new FeatureLayer(layer, {
                    infoTemplate: infoTemplate
                });
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
            // Clear the file that was selected
            dom.byId('inFile').value = "";
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
            // Clear the file that was selected
            dom.byId('inFile').value = "";
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
