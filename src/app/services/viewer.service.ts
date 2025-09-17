import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { environment } from '../../environments/environment';
import { LocalService } from './local.service';
import { MeasureOpts, ViewerMeasureService } from './viewer-measure.service';

declare const Autodesk: any;

@Injectable({
  providedIn: 'root',
})
export class ViewerService {
  private ifcGuidToDbIdMap = new Map<string, number[]>();
  private revitIdToDbIdMap = new Map<string, number>();
  private processedRevitIds: string[] = [];

  _3dviewer: any;
  viewerState: any;
  offset: any;

  constructor(
    private http: HttpClient,
    private localService: LocalService,
    private viewerMeasureService: ViewerMeasureService
  ) {}

  async getAccessToken(): Promise<string> {
    try {
      const response = await this.http
        .get<{ access_token: string; expires_in: number }>(
          environment.accAuthEndpoints.viewerToken
        )
        .toPromise();
      return response!.access_token;
    } catch (error) {
      console.error('Error getting access token from backend:', error);
      throw error;
    }
  }

  initViewer(container: HTMLElement, urn?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const urnToUse = urn;
      console.log('ViewerService: Using URN:', urnToUse);
      const self = this;

      this.getAccessToken()
        .then((token) => {
          Autodesk.Viewing.Initializer(
            {
              env: 'AutodeskProduction',
              getAccessToken: () => token,
            },
            function () {
              const config = {
                extensions: [],
              };
              self._3dviewer = new Autodesk.Viewing.GuiViewer3D(
                container,
                config
              );
              self._3dviewer.start();
              self._3dviewer.setTheme('dark-theme');

              const documentId = 'urn:' + urnToUse;

              Autodesk.Viewing.Document.load(
                documentId,
                async (doc: any) => {
                  const viewables = doc.getRoot().search({ type: 'geometry' });

                  let defaultModel;

                  const desiredViewable = viewables.find(
                    (viewable: { data: { name: string } }) =>
                      viewable.data.name === 'New Construction'
                  );

                  console.log('dddddd', desiredViewable);

                  if (desiredViewable) {
                    defaultModel = desiredViewable;
                  } else {
                    defaultModel = doc.getRoot().getDefaultGeometry();
                  }

                  self._3dviewer
                    .loadDocumentNode(doc, defaultModel)
                    .then(async (model: any) => {
                      self.viewerState = self._3dviewer.getState();
                      console.log(
                        'ViewerService: Current Viewer State:',
                        JSON.stringify(self.viewerState)
                      );
                      self.offset = model.getData().globalOffset;
                      console.log('Global Offset:', self.offset);
                      await self._3dviewer.loadExtension(
                        'Autodesk.DocumentBrowser'
                      );
                      self._3dviewer
                        .loadExtension('Autodesk.DataVisualization')
                        .then(() => {
                          console.log(
                            'DataVisualization extension loaded successfully'
                          );
                        })
                        .catch((err: any) => {
                          console.error(
                            'Failed to load DataVisualization extension',
                            err
                          );
                        });

                      resolve(self._3dviewer);
                    });
                  self._3dviewer.addEventListener(
                    Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
                    async () => {
                      await self.buildRevitIdToDbIdMap();
                      console.log('revitIdToDbIdMap', self.revitIdToDbIdMap);
                    }
                  );

                  // Add geometry loaded event listener
                  self._3dviewer.addEventListener(
                    Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
                    async () => {
                      console.log(
                        '[ViewerService] Geometry loaded event - viewer ready for Rule 7 bollard measurements'
                      );

                      // Geometry loaded - viewer ready for analysis
                    }
                  );
                },
                (error: any) => {
                  console.error(
                    'ViewerService: Error loading document:',
                    error
                  );
                  console.error('ViewerService: Error details:', {
                    status: error.status,
                    statusText: error.statusText,
                    responseText: error.responseText,
                    message: error.message,
                  });
                  reject(error);
                }
              );
            }
          );
        })
        .catch((error) => {
          console.error('ViewerService: Error getting access token:', error);
          reject(error);
        });
    });
  }

  async buildRevitIdToDbIdMap(): Promise<void> {
    const model = this._3dviewer.model;
    const instanceTree = model.getInstanceTree();

    if (!instanceTree) {
      console.error('Instance tree not available.');
      return;
    }

    const rootId = instanceTree.getRootId();
    const allDbIds: number[] = [];
    this._collectAllDbIds(instanceTree, rootId, allDbIds);

    for (const dbId of allDbIds) {
      await new Promise<void>((resolve) => {
        model.getProperties(dbId, (props: any) => {
          const elementIdProp = props.properties.find(
            (p: any) => p.displayName === 'ElementId'
          );
          if (elementIdProp && elementIdProp.displayValue) {
            this.revitIdToDbIdMap.set(elementIdProp.displayValue, dbId);
          }
          resolve();
        });
      });
    }

    console.log(
      'Revit ID to dbId map built with',
      this.revitIdToDbIdMap.size,
      'entries.'
    );
  }

  private _collectAllDbIds(tree: any, nodeId: number, dbIdList: number[]) {
    dbIdList.push(nodeId);
    tree.enumNodeChildren(nodeId, (childId: number) => {
      this._collectAllDbIds(tree, childId, dbIdList);
    });
  }

  mapRevitIdToDbIdFast(revitId: string): number | null {
    return this.revitIdToDbIdMap.get(revitId) ?? null;
  }

  async processModel(revitElementId: string) {
    // Console log the Revit Element ID being processed
    console.log('Processing Revit Element ID:', revitElementId);

    // Add to processed Revit IDs array
    this.processedRevitIds.push(revitElementId);
    console.log(
      'All Revit Element IDs processed so far:',
      this.processedRevitIds
    );

    const dbId = this.mapRevitIdToDbIdFast(revitElementId);
    if (dbId == null) {
      console.warn(`No dbId found for Revit Element ID: ${revitElementId}`);
      return null;
    }

    const model = this._3dviewer.model;
    const fragList = model.getFragmentList();
    const instanceTree = model.getInstanceTree();

    const bbox = new THREE.Box3();
    instanceTree.enumNodeFragments(dbId, (fragId: any) => {
      const fragBbox = new THREE.Box3();
      fragList.getWorldBounds(fragId, fragBbox);
      bbox.union(fragBbox);
    });
    const centroid = new THREE.Vector3();
    bbox.getCenter(centroid);

    const externalId = await new Promise<string | null>((resolve) =>
      model.getProperties(dbId, (props: { externalId: any }) =>
        resolve(props.externalId || null)
      )
    );

    const props = await new Promise<any>((resolve) =>
      model.getProperties(dbId, (props: any) => resolve(props))
    );

    const elementName = props.name || null;

    if (!externalId) {
      console.warn(`No externalId found for dbId: ${dbId}`);
      return null;
    }

    const docNode = model.getDocumentNode();
    const viewable = docNode.data;

    const viewInfo = {
      id: viewable.guid,
      viewableId: viewable.viewableID || viewable.viewableId,
      guid: viewable.guid,
      name: elementName,
      is3D: true,
    };

    const viewerStateCopy = JSON.parse(JSON.stringify(this.viewerState));
    viewerStateCopy.globalOffset = this.offset;

    const payload = {
      position: { x: centroid.x, y: centroid.y, z: centroid.z },
      objectId: dbId,
      externalId,
      viewerState: viewerStateCopy,
      view: viewInfo,
    };

    // console.log(`Payload ${revitElementId}:`, payload);
    return payload;
  }

  // Method to clear processed Revit IDs array (call this before starting a new rule execution)
  clearProcessedRevitIds(): void {
    this.processedRevitIds = [];
    console.log('Cleared processed Revit IDs array');
  }

  // Method to get all processed Revit IDs
  getProcessedRevitIds(): string[] {
    console.log('processedRevitIds', this.processedRevitIds);
    return [...this.processedRevitIds];
  }

  // Method to clear sprite visualization and theming
  clearSpriteVisualization(): void {
    if (this._3dviewer) {
      // Clear theming colors
      this._3dviewer.clearThemingColors(this._3dviewer.model);

      // Clear isolation
      this._3dviewer.isolate([]);

      // Clear Data Visualization extension viewables if available
      const dataVizExt = this._3dviewer.getExtension(
        'Autodesk.DataVisualization'
      );
      if (dataVizExt && dataVizExt.viewableData) {
        dataVizExt.removeAllViewables();
        dataVizExt.invalidateViewables();
      }

      console.log('Cleared sprite visualization and theming');
    }
  }

  highlightElement(revitElementId: string) {
    const dbId = this.mapRevitIdToDbIdFast(revitElementId);
    if (dbId == null) {
      console.warn(`No dbId found for Revit Element ID: ${revitElementId}`);
      return;
    }
    this._3dviewer.isolate(dbId);
  }

  highlightElements(revitElementIds: string[]) {
    if (!revitElementIds || revitElementIds.length === 0) {
      console.warn('No Revit Element IDs provided for highlighting');
      return;
    }

    const dbIds: number[] = [];

    revitElementIds.forEach((revitElementId) => {
      const dbId = this.mapRevitIdToDbIdFast(revitElementId);
      if (dbId != null) {
        dbIds.push(dbId);
      } else {
        console.warn(`No dbId found for Revit Element ID: ${revitElementId}`);
      }
    });

    if (dbIds.length > 0) {
      console.log(`Highlighting ${dbIds.length} elements with dbIds:`, dbIds);
      this._3dviewer.isolate(dbIds);
    } else {
      console.warn(
        'No valid dbIds found for any of the provided Revit Element IDs'
      );
    }
  }

  async highlightFailedElements() {
    const dbIds = this.processedRevitIds

      .map((id) => this.mapRevitIdToDbIdFast(id))
      .filter((id): id is number => id !== null && id !== undefined);
    console.log('dbIds', dbIds);
    const viewer = this._3dviewer;
    const model = viewer.model;

    // 1. Ensure Data Visualization Extension is loaded
    const dataVizExt = await viewer.loadExtension('Autodesk.DataVisualization');
    const DataVizCore = Autodesk?.DataVisualization?.Core;
    if (!DataVizCore) {
      console.error('Autodesk.DataVisualization.Core is not available.');
      return;
    }

    // 2. Isolate and apply red theming
    viewer.clearThemingColors(model);
    viewer.isolate(dbIds);
    dbIds.forEach((id) =>
      viewer.setThemingColor(id, new THREE.Vector4(1, 0, 0, 1))
    );

    // 3. Define glow image sequence
    const baseURL = 'assets/red-glow-frames/';
    const glowIcons = [
      'glow-0.png',
      'glow-1.png',
      'glow-2.png',
      'glow-3.png',
      'glow-4.png',
    ];
    const fullPaths = glowIcons.map((icon) => `${baseURL}${icon}`);

    // 4. Define animated style
    const spriteStyle = new DataVizCore.ViewableStyle(
      DataVizCore.ViewableType.SPRITE,
      new THREE.Color(1, 0, 0), // base color: red
      fullPaths[0], // default image
      new THREE.Color(1, 1, 1), // highlight color: white (optional)
      fullPaths[0], // highlighted image
      fullPaths // animation sequence
    );

    // 5. Prepare viewable data
    const viewableData = new DataVizCore.ViewableData();
    viewableData.spriteSize = 200; // large red sprite

    const instanceTree = model.getInstanceTree();
    const fragList = model.getFragmentList();

    for (const dbId of dbIds) {
      const bbox = new THREE.Box3();
      instanceTree.enumNodeFragments(dbId, (fragId: number) => {
        const fragBBox = new THREE.Box3();
        fragList.getWorldBounds(fragId, fragBBox);
        bbox.union(fragBBox);
      });

      const center = new THREE.Vector3();
      bbox.getCenter(center);

      const sprite = new DataVizCore.SpriteViewable(
        center,
        spriteStyle,
        dbId.toString()
      );
      viewableData.addViewable(sprite);
    }

    await viewableData.finish();
    dataVizExt.addViewables(viewableData);

    // 6. Start animation with pulsing scale + icon frame update
    this.animateGlowingSprites(dataVizExt, baseURL, glowIcons);
  }

  private animateGlowingSprites(
    dataVizExt: any,
    baseURL: string,
    glowIcons: string[]
  ) {
    let iconFrame = 0;
    let scale = 1.0;
    let grow = true;

    const spriteIds = dataVizExt.viewableData.viewables.map((v: any) => v.dbId);

    setInterval(() => {
      // Pulse effect
      scale = grow ? scale + 0.1 : scale - 0.1;
      if (scale >= 2.0) grow = false;
      if (scale <= 1.0) grow = true;

      dataVizExt.invalidateViewables(spriteIds, () => ({
        url: `${baseURL}${glowIcons[iconFrame % glowIcons.length]}`,
        scale: scale,
      }));

      iconFrame++;
    }, 150); // every 150ms
  }

  clearFailedElementsVisuals() {
    const viewer = this._3dviewer;

    if (!viewer) {
      console.log('Viewer not available for clearing visuals');
      return;
    }

    // 1. Clear theming colors
    viewer.clearThemingColors(viewer.model);

    // 2. Show all hidden elements
    viewer.showAll();

    // 3. Remove isolation
    viewer.isolate([]);

    // 4. Remove all Data Visualization sprites
    const dataVizExt = viewer.getExtension('Autodesk.DataVisualization');
    if (dataVizExt && dataVizExt.viewableData) {
      dataVizExt.removeAllViewables();
    }

    // 5. Optionally remove the extension completely (not required unless you want to reload later)
    // viewer.unloadExtension('Autodesk.DataVisualization');

    console.log('Viewer visuals reset to normal.');
  }

  async filterBollardElements(
    viewer: any,
    opts?: {
      select?: boolean; // highlight matches
      onlyLeaves?: boolean; // limit to leaf nodes (typical for instances)
      family?: string; // override family text
      category?: string; // override category text
      typeValue?: string; // override type text
    }
  ): Promise<number[]> {
    console.log(
      '[Bollards] Starting Bollard analysis using ViewerMeasureService...'
    );

    try {
      // Use the new ViewerMeasureService to get comprehensive analysis
      const result = await this.viewerMeasureService.measureBollardDistances(
        viewer,
        {
          select: opts?.select ?? false,
          onlyLeaves: opts?.onlyLeaves ?? true,
          category: opts?.category ?? 'Specialty Equipment',
          family: opts?.family ?? 'TS_Square Bollard',
          typeValue: opts?.typeValue ?? 'Bollard',
        }
      );

      // Extract unique dbIds from the pairs for backward compatibility
      const dbIds = new Set<number>();
      result.directed.forEach((pair) => {
        dbIds.add(pair.a.dbId);
        dbIds.add(pair.b.dbId);
      });

      const uniqueDbIds = Array.from(dbIds);
      console.log(
        `[Bollards] ViewerMeasureService found ${uniqueDbIds.length} unique Bollard elements`
      );

      return uniqueDbIds;
    } catch (error) {
      console.error('[Bollards] Error in ViewerMeasureService:', error);
      return [];
    }
  }

  async measureBollardDistances(viewer: any, opts?: MeasureOpts) {
    console.log('[ViewerService] Starting Bollard distance measurement...');

    try {
      const result = await this.viewerMeasureService.measureBollardDistances(
        viewer,
        {
          select: opts?.select ?? true,
          onlyLeaves: opts?.onlyLeaves ?? true,
          category: opts?.category ?? 'Specialty Equipment',
          family: opts?.family ?? 'TS_Square Bollard',
          typeValue: opts?.typeValue ?? 'Bollard',
          minOverlapXY: opts?.minOverlapXY ?? 5,
          minOverlapZ: opts?.minOverlapZ ?? 5,
          pairing: opts?.pairing ?? 'chain',
          lineTolMM: opts?.lineTolMM ?? 3,
        }
      );

      console.log(
        `[ViewerService] Bollard measurement completed. Found ${result.directed.length} directed pairs and ${result.unique.length} unique pairs.`
      );

      if (result.validation) {
        console.log(
          `[ViewerService] Validation Summary:`,
          result.validation.summary
        );
        console.log(
          `[ViewerService] Validation Results:`,
          result.validation.validationResults
        );
      }

      return result;
    } catch (error) {
      console.error(
        '[ViewerService] Error in Bollard distance measurement:',
        error
      );
      return { directed: [], unique: [] };
    }
  }

  getViewer() {
    return this._3dviewer;
  }

  /**
   * Validates Box elements in Mass category against specified dimensions
   * @returns {Promise<any>} Validation results in specified JSON structure
   */
  async validateMassBoxDimensions(): Promise<any> {
    try {
      const boxDbIds = await this.findMassBoxElements(
        this._3dviewer,
        this._3dviewer.model
      );

      if (boxDbIds.length === 0) {
        return {
          validationResults: [],
          summary: {
            totalElementChecked: 0,
            failedValidations: 0,
            failedWithElementIds: 0,
            failedWithoutElementIds: 0,
            uniqueElementIds: 0,
          },
        };
      }

      const validationResults: any[] = [];
      const failedElementIds = new Set<string>();
      const MIN_LENGTH_MM = 1500; // Minimum required length
      const MIN_WIDTH_MM = 1200; // Minimum required width

      for (const dbId of boxDbIds) {
        try {
          // Get dimensions
          const dimensions = await this.getElementDimensions(
            this._3dviewer,
            this._3dviewer.model,
            dbId
          );

          // Get element properties
          const elementProperties = await new Promise<any>((resolve) => {
            this._3dviewer.model.getProperties(dbId, (props: any) => {
              resolve(props);
            });
          });

          // Extract Comments, Name, and ElementId
          const commentsProp = elementProperties.properties.find(
            (p: any) =>
              p.displayName === 'Comments' || p.displayName === 'comments'
          );
          const elementIdProp = elementProperties.properties.find(
            (p: any) =>
              p.displayName === 'ElementId' || p.displayName === 'Element ID'
          );

          const comments = commentsProp?.displayValue || '';
          const elementName = elementProperties.name || `Element_${dbId}`;
          const elementId = elementIdProp?.displayValue || '';

          // Create combined name: Comments_Name_ElementId
          const combinedName = `${comments}_${elementName}`;

          // Validate dimensions - element passes if it meets minimum requirements
          const lengthValid = dimensions.length >= MIN_LENGTH_MM;
          const widthValid = dimensions.width >= MIN_WIDTH_MM;
          const isValid = lengthValid && widthValid;

          if (!isValid && elementId) {
            failedElementIds.add(elementId);
          }

          validationResults.push({
            Name: combinedName,
            length_mm: dimensions.length,
            width_mm: dimensions.width,
            isValid: isValid,
            elementIds: isValid ? [] : elementId ? [elementId] : [],
          });
        } catch (error) {
          console.error(`Error processing dbId ${dbId}:`, error);
          // Add failed entry for elements that couldn't be processed
          validationResults.push({
            Name: `Error_Element_${dbId}_Unknown`,
            length_mm: 0,
            width_mm: 0,
            isValid: false,
            elementIds: [],
          });
        }
      }

      // Calculate summary
      const failedValidations = validationResults.filter(
        (r) => !r.isValid
      ).length;
      const failedWithElementIds = validationResults.filter(
        (r) => !r.isValid && r.elementIds.length > 0
      ).length;
      const failedWithoutElementIds = failedValidations - failedWithElementIds;

      return {
        validationResults,
        summary: {
          totalElementChecked: boxDbIds.length,
          failedValidations,
          failedWithElementIds,
          failedWithoutElementIds,
          uniqueElementIds: failedElementIds.size,
        },
      };
    } catch (error) {
      console.error('Error in validateMassBoxDimensions:', error);
      return {
        validationResults: [],
        summary: {
          totalElementChecked: 0,
          failedValidations: 0,
          failedWithElementIds: 0,
          failedWithoutElementIds: 0,
          uniqueElementIds: 0,
        },
      };
    }
  }

  /**
   * Find all Box elements under the Mass category
   * @param {any} viewer - the Forge / APS 3D Viewer instance
   * @param {any} model - the model loaded in the viewer
   * @returns {Promise<number[]>} Array of dbIds for Box elements in Mass category
   */
  async findMassBoxElements(viewer: any, model: any): Promise<number[]> {
    return new Promise((resolve) => {
      const instanceTree = model.getInstanceTree();
      if (!instanceTree) {
        console.error('Instance tree not available.');
        resolve([]);
        return;
      }

      const rootId = instanceTree.getRootId();
      const allDbIds: number[] = [];
      this._collectAllDbIds(instanceTree, rootId, allDbIds);

      console.log(`[DEBUG] Total elements to process: ${allDbIds.length}`);

      const boxDbIds: number[] = [];
      const massElements: number[] = [];
      let processedCount = 0;

      if (allDbIds.length === 0) {
        resolve([]);
        return;
      }

      allDbIds.forEach((dbId) => {
        model.getProperties(dbId, (props: any) => {
          processedCount++;

          // Debug: Log all properties for first few elements to understand the structure
          if (processedCount <= 5) {
            console.log(`[DEBUG] Element ${dbId} properties:`, {
              name: props.name,
              properties: props.properties.map((p: any) => ({
                displayName: p.displayName,
                displayValue: p.displayValue,
              })),
            });
          }

          // Check if this element is in Mass category and is a Box
          const categoryProp = props.properties.find(
            (p: any) =>
              p.displayName === 'Category' ||
              p.displayName === 'category' ||
              p.displayName.toLowerCase().includes('category')
          );
          const familyProp = props.properties.find(
            (p: any) =>
              p.displayName === 'Family' ||
              p.displayName === 'family' ||
              p.displayName.toLowerCase().includes('family')
          );
          const typeProp = props.properties.find(
            (p: any) =>
              p.displayName === 'Type' ||
              p.displayName === 'type' ||
              p.displayName.toLowerCase().includes('type')
          );

          // More flexible category matching
          const isInMassCategory =
            categoryProp &&
            (categoryProp.displayValue === 'Mass' ||
              categoryProp.displayValue === 'Massing & Site' ||
              categoryProp.displayValue.toLowerCase().includes('mass'));

          // Track all Mass category elements for debugging
          if (isInMassCategory) {
            massElements.push(dbId);
            console.log(`[DEBUG] Mass category element found:`, {
              dbId,
              name: props.name,
              category: categoryProp?.displayValue,
              family: familyProp?.displayValue,
              type: typeProp?.displayValue,
            });
          }

          // More flexible Box element matching - check name, family, type, and also element name patterns
          const isBoxElement =
            (familyProp &&
              familyProp.displayValue &&
              typeof familyProp.displayValue === 'string' &&
              familyProp.displayValue.toLowerCase().includes('box')) ||
            (typeProp &&
              typeProp.displayValue &&
              typeof typeProp.displayValue === 'string' &&
              typeProp.displayValue.toLowerCase().includes('box')) ||
            (props.name &&
              typeof props.name === 'string' &&
              props.name.toLowerCase().includes('box')) ||
            (props.name &&
              typeof props.name === 'string' &&
              props.name.match(/^Box\s*\d*$/i)); // Match "Box", "Box 1", "Box1", etc.

          // Debug specific elements that might be boxes
          if (props.name && props.name.toLowerCase().includes('box')) {
            console.log(`[DEBUG] Potential Box element found:`, {
              dbId,
              name: props.name,
              category: categoryProp?.displayValue,
              family: familyProp?.displayValue,
              type: typeProp?.displayValue,
              isInMassCategory,
              isBoxElement,
            });
          }

          if (isInMassCategory && isBoxElement) {
            console.log(
              `[ViewerService] Found Box element in Mass category: dbId ${dbId}`,
              {
                name: props.name,
                category: categoryProp?.displayValue,
                family: familyProp?.displayValue,
                type: typeProp?.displayValue,
              }
            );
            boxDbIds.push(dbId);
          }

          // When all elements are processed, resolve with the found Box dbIds
          if (processedCount === allDbIds.length) {
            console.log(`[DEBUG] Processing complete:`);
            console.log(`  - Total elements processed: ${processedCount}`);
            console.log(
              `  - Mass category elements found: ${massElements.length}`
            );
            console.log(
              `  - Box elements in Mass category: ${boxDbIds.length}`
            );
            resolve(boxDbIds);
          }
        });
      });
    });
  }

  /**
   * Get the length and width of a rectangular element in the APS Viewer
   * @param {any} viewer - the Forge / APS 3D Viewer instance
   * @param {any} model - the model loaded in the viewer
   * @param {number} dbId - the element ID whose bounding box you want
   * @returns {Promise<{ length: number, width: number, height: number }>}
   */
  async getElementDimensions(
    viewer: any,
    model: any,
    dbId: number
  ): Promise<{ length: number; width: number; height: number }> {
    console.log(`[DEBUG] Starting getElementDimensions for dbId: ${dbId}`);

    return new Promise((resolve, reject) => {
      try {
        console.log(`[DEBUG] Getting instance tree for dbId: ${dbId}`);

        // Try to get the instance tree directly first
        const instanceTree = model.getInstanceTree();

        if (instanceTree) {
          console.log(
            `[DEBUG] Instance tree available directly for dbId: ${dbId}`
          );
          this.processElementDimensions(
            instanceTree,
            model,
            dbId,
            resolve,
            reject
          );
        } else {
          console.log(
            `[DEBUG] Instance tree not available directly, using callback for dbId: ${dbId}`
          );

          // Fallback to callback method with timeout
          let callbackExecuted = false;

          const timeoutId = setTimeout(() => {
            if (!callbackExecuted) {
              console.error(
                `[DEBUG] Instance tree callback timeout for dbId: ${dbId}`
              );
              reject(
                new Error(`Instance tree callback timeout for dbId ${dbId}`)
              );
            }
          }, 5000); // 5 second timeout

          model.getInstanceTree((instanceTree: any) => {
            if (callbackExecuted) return;
            callbackExecuted = true;
            clearTimeout(timeoutId);

            console.log(
              `[DEBUG] Instance tree callback called for dbId: ${dbId}`
            );

            if (!instanceTree) {
              console.error(
                `[DEBUG] Instance tree not available in callback for dbId: ${dbId}`
              );
              reject(new Error('Instance tree not available.'));
              return;
            }

            this.processElementDimensions(
              instanceTree,
              model,
              dbId,
              resolve,
              reject
            );
          });
        }
      } catch (error) {
        console.error(
          `[DEBUG] Error in getElementDimensions for dbId ${dbId}:`,
          error
        );
        reject(error);
      }
    });
  }

  private processElementDimensions(
    instanceTree: any,
    model: any,
    dbId: number,
    resolve: (value: { length: number; width: number; height: number }) => void,
    reject: (reason?: any) => void
  ): void {
    console.log(`[DEBUG] Processing element dimensions for dbId: ${dbId}`);

    // Get fragments associated with this dbId
    const fragIds: number[] = [];
    instanceTree.enumNodeFragments(
      dbId,
      (fragId: number) => {
        fragIds.push(fragId);
      },
      false
    );

    console.log(`[DEBUG] Found ${fragIds.length} fragments for dbId: ${dbId}`);

    if (fragIds.length === 0) {
      console.error(`[DEBUG] No fragments found for dbId: ${dbId}`);
      reject(new Error(`No fragments found for dbId ${dbId}`));
      return;
    }

    const fragList = model.getFragmentList();
    console.log(`[DEBUG] Got fragment list for dbId: ${dbId}`);

    // Create a Box3 to accumulate bounds
    const boundingBox = new THREE.Box3();

    fragIds.forEach((fragId, index) => {
      const fragBBox = new THREE.Box3();
      fragList.getWorldBounds(fragId, fragBBox);
      boundingBox.union(fragBBox);
      console.log(
        `[DEBUG] Processed fragment ${index + 1}/${
          fragIds.length
        } for dbId: ${dbId}`
      );
    });

    // boundingBox now has min and max in world coordinates
    const sizeVec = new THREE.Vector3();
    boundingBox.getSize(sizeVec);

    console.log(`[DEBUG] Raw dimensions for dbId ${dbId}:`, {
      x: sizeVec.x,
      y: sizeVec.y,
      z: sizeVec.z,
    });

    // sizeVec.x, sizeVec.y, sizeVec.z are width/height/depth depending on orientation

    // Assuming rectangle is flat in, say, XY‐plane,
    // length = max of sizeVec.x, sizeVec.y; width = the other one
    // const dims = [sizeVec.x, sizeVec.y, sizeVec.z].sort((a, b) => b - a);
    // dims[0] is the largest dimension, dims[1] second largest

    // Convert from viewer units (typically feet) to millimeters
    // 1 foot = 304.8 millimeters

    let length, width;

    const dims = [sizeVec.x, sizeVec.y, sizeVec.z];

    if (sizeVec.x > sizeVec.y) {
      length = sizeVec.x;
      width = sizeVec.y;
    } else {
      length = sizeVec.y;
      width = sizeVec.x;
    }

    const FEET_TO_MM = 304.8;

    const result = {
      length: Math.round(length * FEET_TO_MM * 100) / 100, // Round to 2 decimal places
      width: Math.round(width * FEET_TO_MM * 100) / 100,
      height: Math.round(dims[2] * FEET_TO_MM * 100) / 100,
    };

    console.log(`[DEBUG] Final dimensions for dbId ${dbId}:`, result);
    resolve(result);
  }
}
