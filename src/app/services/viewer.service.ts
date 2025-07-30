import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { LocalService } from "./local.service";
import * as THREE from "three";
import { environment } from "../../environments/environment";

declare const Autodesk: any;

@Injectable({
  providedIn: 'root'
})
export class ViewerService {
    private ifcGuidToDbIdMap = new Map<string, number[]>();
    private revitIdToDbIdMap = new Map<string, number>();

    _3dviewer: any;
    viewerState:any;
    offset:any;

    constructor(
        private http: HttpClient,
        private localService: LocalService,
    ) {}

    async getAccessToken(): Promise<string> {
        try {
            const response = await this.http.get<{access_token: string, expires_in: number}>(environment.accAuthEndpoints.viewerToken).toPromise();
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
            const self = this
            
            this.getAccessToken().then(token => {
                Autodesk.Viewing.Initializer({ 
                    env: 'AutodeskProduction', 
                    getAccessToken: () => token
                }, function () {
                    const config = {
                        extensions: []
                    };
                    self._3dviewer = new Autodesk.Viewing.GuiViewer3D(container, config);
                    self._3dviewer.start();
                    self._3dviewer.setTheme('dark-theme');
                    
                    const documentId = 'urn:' + urnToUse;
                    
                    Autodesk.Viewing.Document.load(documentId, async (doc:any) => {
                        const viewables = doc.getRoot().search({'type':'geometry'});

                        let defaultModel;

                        const desiredViewable = viewables.find((viewable: { data: { name: string; }; }) => 
                            viewable.data.name === 'New Construction'
                        );

                        console.log("dddddd",desiredViewable)
                
                        if (desiredViewable) {
                            defaultModel = desiredViewable;
                        } else {
                            defaultModel = doc.getRoot().getDefaultGeometry();
                        }
                
                        self._3dviewer.loadDocumentNode(doc, defaultModel).then(async (model: any) => {
                            self.viewerState = self._3dviewer.getState();
                            console.log('ViewerService: Current Viewer State:', JSON.stringify(self.viewerState));
                            self.offset = model.getData().globalOffset;         
                            console.log('Global Offset:', self.offset);
                            await self._3dviewer.loadExtension('Autodesk.DocumentBrowser');
                            // await self.buildIfcGuidMap();                              
                            resolve(self._3dviewer);
                        });
                        self._3dviewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, async () => {
                            await self.buildRevitIdToDbIdMap();
                            console.log("revitIdToDbIdMap", self.revitIdToDbIdMap)
                          });
                        
                    }, (error: any) => {
                        console.error('ViewerService: Error loading document:', error);
                        console.error('ViewerService: Error details:', {
                            status: error.status,
                            statusText: error.statusText,
                            responseText: error.responseText,
                            message: error.message
                        });
                        reject(error);
                    });
                });
            }).catch(error => {
                console.error('ViewerService: Error getting access token:', error);
                reject(error);
            });
        });
    }





    async buildRevitIdToDbIdMap(): Promise<void> {
        const model = this._3dviewer.model;
        const instanceTree = model.getInstanceTree();
      
        if (!instanceTree) {
          console.error("Instance tree not available.");
          return;
        }
      
        const rootId = instanceTree.getRootId();
        const allDbIds: number[] = [];
        this._collectAllDbIds(instanceTree, rootId, allDbIds);
      
        for (const dbId of allDbIds) {
          await new Promise<void>((resolve) => {
            model.getProperties(dbId, (props: any) => {
              const elementIdProp = props.properties.find((p: any) => p.displayName === 'ElementId');
              if (elementIdProp && elementIdProp.displayValue) {
                this.revitIdToDbIdMap.set(elementIdProp.displayValue, dbId);
              }
              resolve();
            });
          });
        }
      
        console.log("Revit ID to dbId map built with", this.revitIdToDbIdMap.size, "entries.");
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
      
        const externalId = await new Promise<string|null>(resolve =>
          model.getProperties(dbId, (props: { externalId: any; }) => resolve(props.externalId || null))
        );

        const props = await new Promise<any>(resolve =>
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
          is3D: true
        };
      
        const viewerStateCopy = JSON.parse(JSON.stringify(this.viewerState));
        viewerStateCopy.globalOffset = this.offset;
      
        const payload = {
          position: { x: centroid.x, y: centroid.y, z: centroid.z },
          objectId: dbId,
          externalId,
          viewerState: viewerStateCopy,
          view: viewInfo
        };
      
        // console.log(`Payload ${revitElementId}:`, payload);
        return payload;
            
            
      
      }

//       async logAllElementProperties(): Promise<void> {
//   const model = this._3dviewer.model;
//   const instanceTree = model.getInstanceTree();

//   if (!instanceTree) {
//     console.error("Instance tree is not available.");
//     return;
//   }

//   const rootId = instanceTree.getRootId();
//   const allDbIds: number[] = [];
//   this._collectAllDbIds(instanceTree, rootId, allDbIds);

//   console.log(`Traversing ${allDbIds.length} dbIds to log all properties:`);

//   for (const dbId of allDbIds) {
//     await new Promise<void>((resolve) => {
//       model.getProperties(dbId, (props: any) => {
//         console.log(`--- dbId: ${dbId} ---`);
//         console.log(props); // This prints name, externalId, and all properties
//         resolve();
//       });
//     });
//   }

//   console.log("Finished logging properties for all dbIds.");
// }

// private _collectAllDbIds(tree: any, nodeId: number, dbIdList: number[]) {
//   dbIdList.push(nodeId);
//   tree.enumNodeChildren(nodeId, (childId: number) => {
//     this._collectAllDbIds(tree, childId, dbIdList);
//   });
// }


    // async buildIfcGuidMap(): Promise<void> {
    //     return new Promise((resolve, reject) => {
    //         this._3dviewer.model.getObjectTree((instanceTree: any) => {
    //             const allDbIds: number[] = [];
    //             instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId: number) => {
    //                 allDbIds.push(dbId);
    //             }, true);
      
    //     this._3dviewer.model.getBulkProperties(
    //       allDbIds,
    //       ['IfcGUID'],
    //       (results: Array<{ dbId: number; properties: Array<{ displayName: string; displayValue: string }> }>) => {
    //         results.forEach((res) => {
    //           const guidProp = res.properties.find((p) => p.displayName === 'IfcGUID');
    //           if (guidProp && guidProp.displayValue) {
    //             const guid = guidProp.displayValue;
    //           if (!this.ifcGuidToDbIdMap.has(guid)) {
    //             this.ifcGuidToDbIdMap.set(guid, []);
    //           }
    //           this.ifcGuidToDbIdMap.get(guid)!.push(res.dbId);
    //         }
    //       });
    //     //   console.log('IfcGUID map built:', JSON.stringify(Array.from(this.ifcGuidToDbIdMap.entries()), null, 2));
    //       resolve();
    //     }, (error: any) => reject(error));
    //   });
    //   });
    //   }
      
    //   mapIfcGuidToDbIdFast(targetIfcGuid: string): number | null {
    //     const dbIds = this.ifcGuidToDbIdMap.get(targetIfcGuid);
    //     return dbIds ? dbIds[0] : null;
    //   }
      
    //   async processModel(elementIfcGuid: string) {
    //     const dbId = this.mapIfcGuidToDbIdFast(elementIfcGuid);
      
    //     if (dbId == null) {
    //       console.warn(`⚠️ Could not find dbId for IFC GUID: ${elementIfcGuid}`);
    //       return null;
    //     }
      
    //     const fragList = this._3dviewer.model.getFragmentList();
    //     const instanceTree = this._3dviewer.model.getInstanceTree();
    //     const bbox = new THREE.Box3();
      
    //     instanceTree.enumNodeFragments(dbId, (fragId: number) => {
    //       const fragBbox = new THREE.Box3();
    //       fragList.getWorldBounds(fragId, fragBbox);
    //       bbox.union(fragBbox);
    //     });
      
    //     const centroid = new THREE.Vector3();
    //     bbox.getCenter(centroid);
      
    //     console.log(`📦 Calculated centroid for dbId ${dbId}:`, centroid);
      
    //     return {
    //       partId: dbId,
    //       point: `${centroid.x},${centroid.y},${centroid.z}`
    //     };
    //   }
      


}