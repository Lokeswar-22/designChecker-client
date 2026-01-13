import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { environment } from '../../environments/environment';

declare const Autodesk: any;
declare const window: any;

@Injectable({
  providedIn: 'root',
})
export class ViewerService {
  private revitIdToDbIdMap = new Map<string, number>();
  private processedRevitIds: string[] = [];

  _3dviewer: any;
  viewerState: any;
  offset: any;

  constructor(private http: HttpClient) {}

  async getAccessToken(): Promise<string> {
    try {
      const response = await this.http
        .get<{ access_token: string; expires_in: number }>(
          environment.accAuthEndpoints.viewerToken
        )
        .toPromise();
      return response!.access_token;
    } catch (error) {
      throw error;
    }
  }

  initViewer(container: HTMLElement, urn?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const urnToUse = urn;
      const self = this;

      this.getAccessToken()
        .then((token) => {
          Autodesk.Viewing.Initializer(
            {
              env: 'AutodeskProduction2',
              api: 'streamingV2',
              getAccessToken: (onTokenReady: (t: string, e: number) => void) =>
                onTokenReady(token, 3600),
            },
            function () {
              const config = { extensions: [] };
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
                  const desiredViewable = viewables.find(
                    (viewable: { data: { name: string } }) =>
                      viewable.data.name === 'New Construction'
                  );
                  const defaultModel =
                    desiredViewable || doc.getRoot().getDefaultGeometry();

                  self._3dviewer
                    .loadDocumentNode(doc, defaultModel)
                    .then(async (model: any) => {
                      self.viewerState = self._3dviewer.getState();
                      self.offset = model.getData().globalOffset;
                      await self._3dviewer.loadExtension(
                        'Autodesk.DocumentBrowser'
                      );
                      await self._3dviewer.loadExtension(
                        'Autodesk.AEC.LevelsExtension'
                      );
                      self._3dviewer
                        .loadExtension('Autodesk.DataVisualization')
                        .catch(() => {});

                      if (window.nrlviewer?.mediator) {
                        window.nrlviewer.mediator.customEvents.emit(
                          'viewer_loaded',
                          self._3dviewer
                        );
                      }

                      resolve(self._3dviewer);
                    });

                  self._3dviewer.addEventListener(
                    Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
                    async () => {
                      await self.buildRevitIdToDbIdMap();
                    }
                  );
                },
                (error: any) => {
                  reject(error);
                }
              );
            }
          );
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  async buildRevitIdToDbIdMap(): Promise<void> {
    const model = this._3dviewer.model;
    const instanceTree = model.getInstanceTree();
    if (!instanceTree) return;

    const rootId = instanceTree.getRootId();
    const allDbIds: number[] = [];
    this._collectAllDbIds(instanceTree, rootId, allDbIds);

    return new Promise((resolve) => {
      model.getBulkProperties(allDbIds, ['ElementId'], (results: any[]) => {
        results.forEach((result) => {
          const elementIdProp = result.properties.find(
            (p: any) => p.displayName === 'ElementId'
          );
          if (elementIdProp?.displayValue) {
            this.revitIdToDbIdMap.set(elementIdProp.displayValue, result.dbId);
          }
        });
        resolve();
      });
    });
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
    this.processedRevitIds.push(revitElementId);
    const dbId = this.mapRevitIdToDbIdFast(revitElementId);
    if (dbId == null) return null;

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

    const props = await new Promise<any>((resolve) =>
      model.getProperties(dbId, (p: any) => resolve(p))
    );
    if (!props?.externalId) return null;

    const viewable = model.getDocumentNode().data;
    const viewerStateCopy = JSON.parse(JSON.stringify(this.viewerState));
    viewerStateCopy.globalOffset = this.offset;

    return {
      position: { x: centroid.x, y: centroid.y, z: centroid.z },
      objectId: dbId,
      externalId: props.externalId,
      viewerState: viewerStateCopy,
      view: {
        id: viewable.guid,
        viewableId: viewable.viewableID || viewable.viewableId,
        guid: viewable.guid,
        name: props.name || null,
        is3D: true,
      },
    };
  }

  clearProcessedRevitIds(): void {
    this.processedRevitIds = [];
  }

  getProcessedRevitIds(): string[] {
    return [...this.processedRevitIds];
  }

  clearSpriteVisualization(): void {
    if (this._3dviewer) {
      this._3dviewer.clearThemingColors(this._3dviewer.model);
      this._3dviewer.isolate([]);
      const dataVizExt = this._3dviewer.getExtension(
        'Autodesk.DataVisualization'
      );
      if (dataVizExt?.viewableData) {
        dataVizExt.removeAllViewables();
        dataVizExt.invalidateViewables();
      }
    }
  }

  highlightElement(revitElementId: string) {
    const dbId = this.mapRevitIdToDbIdFast(revitElementId);
    if (dbId != null) this._3dviewer.highlight(dbId);
  }

  async highlightFailedElements() {
    const dbIds = this.processedRevitIds
      .map((id) => this.mapRevitIdToDbIdFast(id))
      .filter((id): id is number => id !== null && id !== undefined);

    const viewer = this._3dviewer;
    const model = viewer.model;

    const dataVizExt = await viewer.loadExtension('Autodesk.DataVisualization');
    const DataVizCore = Autodesk?.DataVisualization?.Core;
    if (!DataVizCore) return;

    viewer.clearThemingColors(model);
    viewer.isolate(dbIds);
    dbIds.forEach((id) =>
      viewer.setThemingColor(id, new THREE.Vector4(1, 0, 0, 1))
    );

    const baseURL = 'assets/red-glow-frames/';
    const glowIcons = [
      'glow-0.png',
      'glow-1.png',
      'glow-2.png',
      'glow-3.png',
      'glow-4.png',
    ];
    const fullPaths = glowIcons.map((icon) => `${baseURL}${icon}`);

    const spriteStyle = new DataVizCore.ViewableStyle(
      DataVizCore.ViewableType.SPRITE,
      new THREE.Color(1, 0, 0),
      fullPaths[0],
      new THREE.Color(1, 1, 1),
      fullPaths[0],
      fullPaths
    );

    const viewableData = new DataVizCore.ViewableData();
    viewableData.spriteSize = 200;

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
      viewableData.addViewable(
        new DataVizCore.SpriteViewable(center, spriteStyle, dbId.toString())
      );
    }

    await viewableData.finish();
    dataVizExt.addViewables(viewableData);
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
      scale = grow ? scale + 0.1 : scale - 0.1;
      if (scale >= 2.0) grow = false;
      if (scale <= 1.0) grow = true;
      dataVizExt.invalidateViewables(spriteIds, () => ({
        url: `${baseURL}${glowIcons[iconFrame % glowIcons.length]}`,
        scale: scale,
      }));
      iconFrame++;
    }, 150);
  }

  clearFailedElementsVisuals() {
    const viewer = this._3dviewer;
    if (!viewer) return;
    viewer.clearThemingColors(viewer.model);
    viewer.showAll();
    viewer.isolate([]);
    const dataVizExt = viewer.getExtension('Autodesk.DataVisualization');
    if (dataVizExt?.viewableData) dataVizExt.removeAllViewables();
  }
}
