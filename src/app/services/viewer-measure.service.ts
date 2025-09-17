import { Injectable } from '@angular/core';
declare const THREE: any;
declare const Autodesk: any;

export type Axis = 'x' | 'y';

export interface MeasureOpts {
  select?: boolean; // highlight closest (default true)
  onlyLeaves?: boolean; // default true
  category?: string; // default 'Specialty Equipment'
  family?: string; // default 'TS_Square Bollard'
  typeValue?: string; // default 'Bollard'
  minOverlapXY?: number; // mm, orthogonal horizontal overlap (default 5)
  minOverlapZ?: number; // mm, vertical overlap (default 5)
  dominanceRatio?: number; // require |Δaxis| / |Δorth| >= ratio (default 1.0)
  pairing?: 'matching' | 'chain'; // NEW (default: 'chain')
  lineTolMM?: number; // NEW: how tight a line bucket is (default 3 mm)
}

export interface BollardInfo {
  dbId: number;
  label: string;
  bbox: any;
  center: any;
  size: any;
}

export interface PairMeasure {
  a: BollardInfo;
  b: BollardInfo;
  axis: Axis;
  faces: { aFace: string; bFace: string };
  centerDist: number; // model units
  faceDistAABB: number; // model units
  faceDistRay?: number | null; // model units (null if blocked/no hit)
  centerDist_mm: number;
  faceDistAABB_mm: number;
  faceDistRay_mm: number | null;
}

export interface BollardValidationResult {
  A_Label: string;
  B_Label: string;
  isValid: boolean;
  clearDistanceBetweenBollard: number | null;
  elementIds: string[];
}

export interface BollardValidationResponse {
  validationResults: BollardValidationResult[];
  summary: {
    totalBollards_Count: number;
    totalBollards_pairs: number;
    failedValidations: number;
    failedWithElementIds: number;
  };
}

type SkipReason =
  | 'UNDIRECTED_USED'
  | 'DOMINANCE_FAIL_X'
  | 'DOMINANCE_FAIL_Y'
  | 'ORTH_OVERLAP_FAIL_X'
  | 'ORTH_OVERLAP_FAIL_Y'
  | 'VERT_OVERLAP_FAIL_X'
  | 'VERT_OVERLAP_FAIL_Y'
  | 'LOS_BLOCKED' // first non-self hit is not B
  | 'LOS_SELF_HIT_LOOP'; // we kept hitting A

@Injectable({ providedIn: 'root' })
export class ViewerMeasureService {
  async measureBollardDistances(viewer: any, opts?: MeasureOpts) {
    const log = (...a: any[]) => console.log('[BOLLARDS]', ...a);

    const model = viewer?.model;
    const tree = model?.getInstanceTree();
    if (!viewer || !model || !tree) {
      console.error('[BOLLARDS] Viewer/model/instanceTree not ready.');
      return { directed: [] as PairMeasure[], unique: [] as PairMeasure[] };
    }

    // Debug bucket to track why candidates are skipped
    const debugSkips: Record<
      number,
      Array<{ forB: number; reason: SkipReason; detail?: any }>
    > = {};
    const addSkip = (
      aId: number,
      bId: number,
      reason: SkipReason,
      detail?: any
    ) => {
      (debugSkips[aId] ||= []).push({ forB: bId, reason, detail });
    };

    // 1) find bollards fast via bulk properties
    const bollardDbIds = Array.from(
      new Set(await this.filterBollards(viewer, opts))
    );
    if (!bollardDbIds.length) return { directed: [], unique: [] };

    // 2) labels (+ Element Id / GUID if present)
    const labelMap = await this.getElementLabels(viewer, bollardDbIds);

    // 3) geometry
    const bollards = await this.buildGeometry(viewer, bollardDbIds, labelMap);
    const infos = [...bollards.values()];

    // 4) units
    const unitScale = model.getUnitScale(); // to meters
    const unitStr = model.getUnitString?.() ?? 'unit';
    const toMM = (d: number) => d * unitScale * 1000;

    // thresholds
    const minOverlapXY =
      Math.max(0, opts?.minOverlapXY ?? 5) / 1000 / unitScale;
    const minOverlapZ = Math.max(0, opts?.minOverlapZ ?? 5) / 1000 / unitScale;
    const dominanceRatio = Math.max(1.0, opts?.dominanceRatio ?? 1.0); // >=1.0

    // 5) Choose pairing mode and build adjacency
    const pairing = opts?.pairing ?? 'chain';
    const lineTol = Math.max(0, opts?.lineTolMM ?? 3) / 1000 / unitScale; // mm -> model units

    let directed: PairMeasure[] = [];

    if (pairing === 'chain') {
      directed = await this.buildChainAdjacency(viewer, infos, {
        minOverlapXY,
        minOverlapZ,
        dominanceRatio: Math.max(0.8, opts?.dominanceRatio ?? 1.0), // a bit looser at corners
        lineTol,
      });
    } else {
      directed = await this.buildMatchingAdjacency(viewer, infos, {
        minOverlapXY,
        minOverlapZ,
        dominanceRatio: Math.max(1.0, opts?.dominanceRatio ?? 1.0),
        addSkip,
        debugSkips,
      });
    }

    // 7) unique is the same set we enforced during assignment
    const unique = directed.slice();

    // 8) logs
    console.log(
      `[Units] Model unit: ${unitStr}; unitScale (to meters): ${unitScale}`
    );
    console.table(
      directed.map((p) => ({
        A_dbId: p.a.dbId,
        A_Label: p.a.label,
        B_dbId: p.b.dbId,
        B_Label: p.b.label,
        Axis: p.axis.toUpperCase(),
        Faces: `${p.faces.aFace} ↔ ${p.faces.bFace}`,
        CenterDist: +p.centerDist.toFixed(3),
        AABB_FaceDist: +p.faceDistAABB.toFixed(3),
        RaycastDist: p.faceDistRay == null ? null : +p.faceDistRay.toFixed(3),
        CenterDist_mm: p.centerDist_mm,
        AABB_FaceDist_mm: p.faceDistAABB_mm,
        RaycastDist_mm: p.faceDistRay_mm,
      }))
    );
    console.log(
      `[BOLLARDS] Directed checks: ${directed.length} | Unique pairs: ${unique.length}`
    );

    // Debug: Print audit of anything that didn't get a pair
    const havePair = new Set(directed.flatMap((p) => [p.a.dbId, p.b.dbId]));
    const noPair = infos.filter(
      (x) => !directed.some((p) => p.a.dbId === x.dbId)
    );
    if (noPair.length) {
      console.group('[BOLLARDS] Missing pairs — detailed reasons');
      for (const a of noPair) {
        console.group(`A dbId:${a.dbId} "${a.label}"`);
        const rows = debugSkips[a.dbId] || [];
        if (!rows.length) console.warn('No candidates were evaluated.');
        for (const r of rows) {
          console.log(`  tried B dbId:${r.forB} → ${r.reason}`, r.detail || '');
        }
        console.groupEnd();
      }
      console.groupEnd();
    }

    // optional highlight closest
    if ((opts?.select ?? true) && directed.length) {
      const best = directed
        .slice()
        .sort((a, b) => a.faceDistAABB - b.faceDistAABB)[0];
      viewer.clearSelection();
      viewer.select([best.a.dbId, best.b.dbId]);
      viewer.fitToView([best.a.dbId, best.b.dbId]);
    }

    // 9) Validation - Check if RaycastDist_mm meets minimum requirement (900mm)
    const validationResults = this.validateBollardDistances(directed);

    // 10) Log validation results
    console.log('[BOLLARDS] Validation Results:', validationResults);

    return { directed, unique, validation: validationResults };
  }

  /**
   * Validate bollard distances against minimum requirement of 900mm
   */
  private validateBollardDistances(
    pairs: PairMeasure[]
  ): BollardValidationResponse {
    const validationResults: BollardValidationResult[] = [];
    const minDistanceMM = 900; // Minimum required distance in millimeters
    let failedValidations = 0;
    let failedWithElementIds = 0;

    // Get unique bollard count
    const uniqueBollards = new Set<number>();
    pairs.forEach((pair) => {
      uniqueBollards.add(pair.a.dbId);
      uniqueBollards.add(pair.b.dbId);
    });

    for (const pair of pairs) {
      const raycastDistMM = pair.faceDistRay_mm;
      const isValid = raycastDistMM !== null && raycastDistMM >= minDistanceMM;

      const validationResult: BollardValidationResult = {
        A_Label: pair.a.label,
        B_Label: pair.b.label,
        isValid: isValid,
        clearDistanceBetweenBollard: raycastDistMM,
        elementIds: isValid ? [] : [pair.a.label, pair.b.label], // Only add to elementIds if failed
      };

      validationResults.push(validationResult);

      if (!isValid) {
        failedValidations++;
        if (raycastDistMM !== null) {
          failedWithElementIds++;
        }
      }
    }

    const summary = {
      totalBollards_Count: uniqueBollards.size,
      totalBollards_pairs: pairs.length,
      failedValidations: failedValidations,
      failedWithElementIds: failedWithElementIds,
    };

    return {
      validationResults,
      summary,
    };
  }

  // ---------- pairing modes ----------

  /** Group bollards into horizontal & vertical lines, then pair neighbors */
  private bucketByConstant(
    infos: BollardInfo[],
    axis: 'x' | 'y',
    tol: number
  ): BollardInfo[][] {
    // group by nearly-constant coordinate on the ORTHOGONAL axis
    const k = axis === 'x' ? 'y' : 'x';
    const buckets = new Map<number, BollardInfo[]>();
    for (const o of infos) {
      const key = Math.round(o.center[k] / tol); // bucket index
      const arr = buckets.get(key) || [];
      arr.push(o);
      buckets.set(key, arr);
    }
    // merge adjacent buckets if they're within tol (robustness for slight drift)
    const keys = [...buckets.keys()].sort((a, b) => a - b);
    const merged: BollardInfo[][] = [];
    let cur: BollardInfo[] = [];
    let last: number | undefined;
    for (const key of keys) {
      if (last == null || Math.abs(key - last) <= 1) {
        cur.push(...buckets.get(key)!);
      } else {
        merged.push(cur);
        cur = [...buckets.get(key)!];
      }
      last = key;
    }
    if (cur.length) merged.push(cur);
    // drop tiny clusters (singletons don't create pairs)
    return merged.filter((arr) => arr.length >= 2);
  }

  private async buildChainAdjacency(
    viewer: any,
    infos: BollardInfo[],
    opts: {
      minOverlapXY: number;
      minOverlapZ: number;
      dominanceRatio: number;
      lineTol: number;
    }
  ): Promise<PairMeasure[]> {
    const unitScale = viewer.model.getUnitScale();
    const toMM = (d: number) => d * unitScale * 1000;

    const uniq = new Set<string>();
    const out: PairMeasure[] = [];

    // 1) horizontal lines (pair along +X)
    const hLines = this.bucketByConstant(infos, 'x', opts.lineTol);
    for (const line of hLines) {
      const sorted = line.slice().sort((a, b) => a.center.x - b.center.x);
      for (let i = 0; i < sorted.length - 1; i++) {
        const A = sorted[i],
          B = sorted[i + 1];
        const choice = this.bestAxisIfValid(
          A,
          B,
          opts.minOverlapXY,
          opts.minOverlapZ,
          opts.dominanceRatio
        );
        if (!choice || choice.axis !== 'x') continue; // must be horizontal
        const key = this.undirectedKey(A.dbId, B.dbId);
        if (uniq.has(key)) continue;

        // Ray only for logging (don't block)
        const rayHit = await this.raycastFaceDistance(viewer, A, B, 'x');

        const pm: PairMeasure = {
          a: A,
          b: B,
          axis: 'x',
          faces: this.faceNames('x', this.signDelta(A, B, 'x')),
          centerDist: A.center.distanceTo(B.center),
          faceDistAABB: choice.faceDist,
          faceDistRay: rayHit,
          centerDist_mm: +toMM(A.center.distanceTo(B.center)).toFixed(1),
          faceDistAABB_mm: +toMM(choice.faceDist).toFixed(1),
          faceDistRay_mm: rayHit == null ? null : +toMM(rayHit).toFixed(1),
        };
        out.push(pm);
        uniq.add(key);
      }
    }

    // 2) vertical lines (pair along +Y)
    const vLines = this.bucketByConstant(infos, 'y', opts.lineTol);
    for (const line of vLines) {
      const sorted = line.slice().sort((a, b) => a.center.y - b.center.y);
      for (let i = 0; i < sorted.length - 1; i++) {
        const A = sorted[i],
          B = sorted[i + 1];
        const choice = this.bestAxisIfValid(
          A,
          B,
          opts.minOverlapXY,
          opts.minOverlapZ,
          opts.dominanceRatio
        );
        if (!choice || choice.axis !== 'y') continue; // must be vertical
        const key = this.undirectedKey(A.dbId, B.dbId);
        if (uniq.has(key)) continue;

        const rayHit = await this.raycastFaceDistance(viewer, A, B, 'y');

        const pm: PairMeasure = {
          a: A,
          b: B,
          axis: 'y',
          faces: this.faceNames('y', this.signDelta(A, B, 'y')),
          centerDist: A.center.distanceTo(B.center),
          faceDistAABB: choice.faceDist,
          faceDistRay: rayHit,
          centerDist_mm: +toMM(A.center.distanceTo(B.center)).toFixed(1),
          faceDistAABB_mm: +toMM(choice.faceDist).toFixed(1),
          faceDistRay_mm: rayHit == null ? null : +toMM(rayHit).toFixed(1),
        };
        out.push(pm);
        uniq.add(key);
      }
    }

    return out;
  }

  private async buildMatchingAdjacency(
    viewer: any,
    infos: BollardInfo[],
    opts: {
      minOverlapXY: number;
      minOverlapZ: number;
      dominanceRatio: number;
      addSkip: (
        aId: number,
        bId: number,
        reason: SkipReason,
        detail?: any
      ) => void;
      debugSkips: Record<
        number,
        Array<{ forB: number; reason: SkipReason; detail?: any }>
      >;
    }
  ): Promise<PairMeasure[]> {
    // Original matching logic (current implementation)
    const candidatesByA = new Map<number, BollardInfo[]>();
    for (const A of infos) {
      const sorted = infos
        .filter((B) => B.dbId !== A.dbId)
        .map((B) => ({ B, d2: this.planarDist2(A.center, B.center) }))
        .sort((p, q) => p.d2 - q.d2)
        .map((x) => x.B);
      candidatesByA.set(A.dbId, sorted);
    }

    const directed: PairMeasure[] = [];
    const usedUndirected = new Set<string>();

    const unitScale = viewer.model.getUnitScale();
    const toMM = (d: number) => d * unitScale * 1000;

    for (const A of infos) {
      const candidates = candidatesByA.get(A.dbId)!;
      let picked: PairMeasure | null = null;

      for (const B of candidates) {
        const undKey = this.undirectedKey(A.dbId, B.dbId);
        if (usedUndirected.has(undKey)) {
          opts.addSkip(A.dbId, B.dbId, 'UNDIRECTED_USED');
          continue;
        }

        const choice = this.bestAxisIfValid(
          A,
          B,
          opts.minOverlapXY,
          opts.minOverlapZ,
          opts.dominanceRatio,
          (axis, why, metrics) => {
            opts.addSkip(A.dbId, B.dbId, why as SkipReason, {
              axis,
              ...metrics,
            });
          }
        );
        if (!choice) continue;

        // LOS raycast: must hit B first, or we reject
        const rayHit = await this.raycastHitFirst(viewer, A, B, choice.axis);
        if (!rayHit.ok) {
          opts.addSkip(A.dbId, B.dbId, rayHit.reason as SkipReason, {
            firstDbId: rayHit.firstDbId,
          });
          continue;
        }

        picked = {
          a: A,
          b: B,
          axis: choice.axis,
          faces: this.faceNames(choice.axis, this.signDelta(A, B, choice.axis)),
          centerDist: A.center.distanceTo(B.center),
          faceDistAABB: choice.faceDist,
          faceDistRay: rayHit.distance,
          centerDist_mm: +toMM(A.center.distanceTo(B.center)).toFixed(1),
          faceDistAABB_mm: +toMM(choice.faceDist).toFixed(1),
          faceDistRay_mm:
            rayHit.distance == null ? null : +toMM(rayHit.distance).toFixed(1),
        };

        usedUndirected.add(undKey);
        break;
      }
      if (picked) directed.push(picked);
    }

    return directed;
  }

  // ---------- filtering & labels ----------

  private async filterBollards(
    viewer: any,
    opts?: MeasureOpts
  ): Promise<number[]> {
    const model = viewer.model;
    const tree = model.getInstanceTree();
    const CATEGORY_EQ = (opts?.category ?? 'Specialty Equipment').toLowerCase();
    const FAMILY_EQ = (opts?.family ?? 'TS_Square Bollard').toLowerCase();
    const TYPE_EQ = (opts?.typeValue ?? 'Bollard').toLowerCase();

    const ids: number[] = [];
    const rootId = tree.getRootId();
    const onlyLeaves = opts?.onlyLeaves ?? true;

    if (onlyLeaves) {
      const walk = (id: number) => {
        const n = tree.getChildCount(id);
        if (n === 0) ids.push(id);
        else tree.enumNodeChildren(id, walk);
      };
      tree.enumNodeChildren(rootId, walk);
    } else {
      const stack = [rootId];
      while (stack.length) {
        const id = stack.pop()!;
        ids.push(id);
        tree.enumNodeChildren(id, (c: number) => stack.push(c));
      }
    }
    if (!ids.length) return [];

    // bulk properties (fast) – official API
    const propNames = [
      'Category',
      'Category Name',
      'Family',
      'Family Name',
      'Type',
      'Type Name',
      'Element Type',
      'Name',
    ];
    const rows = await new Promise<any[]>((resolve, reject) => {
      model.getBulkProperties(
        ids,
        { propFilter: propNames },
        (res: any) => resolve(res || []),
        (err: any) => reject(err)
      );
    });

    const matches: number[] = [];
    for (const r of rows) {
      const map = new Map<string, string>();
      for (const p of r.properties || []) {
        map.set(p.displayName, String(p.displayValue ?? '').toLowerCase());
      }
      const cat = map.get('Category') ?? map.get('Category Name') ?? '';
      const fam = map.get('Family') ?? map.get('Family Name') ?? '';
      const type =
        map.get('Type') ??
        map.get('Type Name') ??
        map.get('Element Type') ??
        '';
      const isSpecialty =
        cat.includes('specialty equipment') || cat === CATEGORY_EQ;
      const isBollardFam = fam.includes('bollard') || fam === FAMILY_EQ;
      const isBollardType = type.includes('bollard') || type === TYPE_EQ;
      if (isSpecialty && isBollardFam && isBollardType) matches.push(r.dbId);
    }
    if (!matches.length) {
      for (const r of rows) {
        const vals = (r.properties || []).map((p: any) =>
          String(p.displayValue ?? '').toLowerCase()
        );
        const hasBollard = vals.some((v: string) => v.includes('bollard'));
        const isSpec = vals.some((v: string) =>
          v.includes('specialty equipment')
        );
        if (hasBollard && isSpec) matches.push(r.dbId);
      }
    }
    return Array.from(new Set(matches));
  }

  private async getElementLabels(viewer: any, dbIds: number[]) {
    const model = viewer.model;
    const propNames = ['Name', 'ElementId'];
    const rows = await new Promise<any[]>((resolve, reject) => {
      model.getBulkProperties(
        dbIds,
        { propFilter: propNames },
        (res: any) => resolve(res || []),
        (err: any) => reject(err)
      );
    });

    const map = new Map<number, string>();
    for (const r of rows) {
      let nm: string | undefined,
        typeName: string | undefined,
        familyName: string | undefined;
      let elId: string | undefined, guid: string | undefined;
      for (const p of r.properties || []) {
        const dv = String(p.displayValue ?? '');
        if (!nm && (p.displayName === 'Name' || p.displayName === 'name'))
          nm = dv;
        if (
          !typeName &&
          (p.displayName === 'Type Name' || p.displayName === 'Type')
        )
          typeName = dv;
        if (
          !familyName &&
          (p.displayName === 'Family Name' || p.displayName === 'Family')
        )
          familyName = dv;
        if (!elId && p.displayName === 'ElementId') elId = dv;
        if (!guid && p.displayName === 'IfcGUID') guid = dv;
      }
      const namePart =
        nm || typeName || familyName || (elId ? `${elId}` : undefined);
      const finalLabel =
        namePart && guid
          ? `${namePart}_${guid}`
          : namePart || guid || `dbId_${r.dbId}`;
      map.set(r.dbId, finalLabel);
    }
    return map;
  }

  // ---------- geometry & math ----------

  private async buildGeometry(
    viewer: any,
    dbIds: number[],
    labelMap: Map<number, string>
  ) {
    const model = viewer.model;
    const tree = model.getInstanceTree();
    const frags = model.getFragmentList();

    const out = new Map<number, BollardInfo>();
    for (const id of dbIds) {
      const bbox = new THREE.Box3();
      tree.enumNodeFragments(
        id,
        (fragId: number) => {
          const fb = new THREE.Box3();
          frags.getWorldBounds(fragId, fb); // fragment world bounds
          bbox.union(fb);
        },
        true
      );

      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      out.set(id, { dbId: id, label: labelMap.get(id)!, bbox, center, size });
    }
    return out;
  }

  private planarDist2(a: any, b: any) {
    const dx = a.x - b.x,
      dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  private intervalOverlap(
    aMin: number,
    aMax: number,
    bMin: number,
    bMax: number
  ) {
    const lo = Math.max(aMin, bMin);
    const hi = Math.min(aMax, bMax);
    return Math.max(0, hi - lo);
  }

  private signDelta(A: BollardInfo, B: BollardInfo, axis: Axis) {
    return B.center[axis] - A.center[axis] >= 0 ? +1 : -1;
  }

  private faceNames(axis: Axis, sign: number) {
    if (axis === 'x')
      return {
        aFace: sign >= 0 ? 'A.maxX' : 'A.minX',
        bFace: sign >= 0 ? 'B.minX' : 'B.maxX',
      };
    return {
      aFace: sign >= 0 ? 'A.maxY' : 'A.minY',
      bFace: sign >= 0 ? 'B.minY' : 'B.maxY',
    };
  }

  /** Pick axis if valid (overlaps + dominance), returning smaller face distance */
  private bestAxisIfValid(
    A: BollardInfo,
    B: BollardInfo,
    minOverlapXY: number,
    minOverlapZ: number,
    dominanceRatio: number,
    onFail?: (
      axis: Axis,
      why:
        | 'DOMINANCE_FAIL_X'
        | 'DOMINANCE_FAIL_Y'
        | 'ORTH_OVERLAP_FAIL_X'
        | 'ORTH_OVERLAP_FAIL_Y'
        | 'VERT_OVERLAP_FAIL_X'
        | 'VERT_OVERLAP_FAIL_Y',
      metrics: any
    ) => void
  ): { axis: Axis; faceDist: number } | null {
    const tryAxis = (axis: Axis): { axis: Axis; faceDist: number } | null => {
      const ortho: Axis = axis === 'x' ? 'y' : 'x';
      const dAxis = Math.abs(B.center[axis] - A.center[axis]);
      const dOrtho = Math.abs(B.center[ortho] - A.center[ortho]);

      if (dOrtho > 0 && dAxis / dOrtho < dominanceRatio) {
        onFail?.(axis, axis === 'x' ? 'DOMINANCE_FAIL_X' : 'DOMINANCE_FAIL_Y', {
          dAxis,
          dOrtho,
          ratio: dAxis / dOrtho,
        });
        return null;
      }

      const o = this.intervalOverlap(
        A.bbox.min[ortho],
        A.bbox.max[ortho],
        B.bbox.min[ortho],
        B.bbox.max[ortho]
      );
      if (o < minOverlapXY) {
        onFail?.(
          axis,
          axis === 'x' ? 'ORTH_OVERLAP_FAIL_X' : 'ORTH_OVERLAP_FAIL_Y',
          { overlap: o, minOverlapXY }
        );
        return null;
      }

      const oz = this.intervalOverlap(
        A.bbox.min.z,
        A.bbox.max.z,
        B.bbox.min.z,
        B.bbox.max.z
      );
      if (oz < minOverlapZ) {
        onFail?.(
          axis,
          axis === 'x' ? 'VERT_OVERLAP_FAIL_X' : 'VERT_OVERLAP_FAIL_Y',
          { overlapZ: oz, minOverlapZ }
        );
        return null;
      }

      const halfA = A.size[axis] / 2;
      const halfB = B.size[axis] / 2;
      const centerDist = dAxis;
      const faceDist = Math.max(0, centerDist - halfA - halfB);
      return { axis, faceDist };
    };

    const ax = tryAxis('x');
    const ay = tryAxis('y');
    if (ax && ay) return ax.faceDist <= ay.faceDist ? ax : ay;
    return ax || ay;
  }

  /**
   * LOS raycast: unfiltered ray (NO dbId filter). The FIRST hit must be B
   * or the pair is rejected. This prevents "different faces/blocked" pairings.
   * (Ensure GEOMETRY_LOADED before calling rayIntersect.)
   */
  private async raycastHitFirst(
    viewer: any,
    A: BollardInfo,
    B: BollardInfo,
    axis: Axis
  ): Promise<{
    ok: boolean;
    distance: number | null;
    reason?: string;
    firstDbId?: number;
  }> {
    try {
      const unitScale = viewer.model.getUnitScale(); // to meters
      const eps = 1 /*mm*/ / 1000 / unitScale; // 1 mm in model units

      const dir = new THREE.Vector3(0, 0, 0);
      dir[axis] = B.center[axis] - A.center[axis] >= 0 ? +1 : -1;

      const ortho: Axis = axis === 'x' ? 'y' : 'x';
      const origin = A.center.clone();
      origin[axis] += (A.size[axis] / 2 + eps * 2) * dir[axis]; // step outside A more aggressively
      origin[ortho] = Math.max(
        A.bbox.min[ortho],
        Math.min(origin[ortho], A.bbox.max[ortho])
      );
      origin[ortho] = Math.max(
        B.bbox.min[ortho],
        Math.min(origin[ortho], B.bbox.max[ortho])
      );
      origin.z =
        (Math.max(A.bbox.min.z, B.bbox.min.z) +
          Math.min(A.bbox.max.z, B.bbox.max.z)) /
        2;

      const ray = new THREE.Raycaster(origin, dir);

      const cast = (rc: any) => {
        const m: any = viewer.model as any;
        if (typeof m.rayIntersect === 'function')
          return m.rayIntersect(rc, false);
        const impl: any = viewer.impl as any;
        if (typeof impl.rayIntersect === 'function')
          return impl.rayIntersect(rc, false);
        return null;
      };

      const hits = cast(ray);
      if (!hits) return { ok: false, distance: null, reason: 'LOS_BLOCKED' };
      const list = Array.isArray(hits) ? hits : [hits];
      if (!list.length)
        return { ok: false, distance: null, reason: 'LOS_BLOCKED' };

      // Skip self-hit(s) and near-zero hits
      const firstNonSelf = list.find(
        (h) =>
          h.dbId !== A.dbId &&
          (typeof h.distance !== 'number' || h.distance > eps * 1.5)
      );
      if (!firstNonSelf)
        return { ok: false, distance: null, reason: 'LOS_SELF_HIT_LOOP' };

      const ok = firstNonSelf.dbId === B.dbId;
      return {
        ok,
        distance:
          ok && typeof firstNonSelf.distance === 'number'
            ? firstNonSelf.distance
            : null,
        reason: ok ? undefined : 'LOS_BLOCKED',
        firstDbId: firstNonSelf.dbId,
      };
    } catch {
      return { ok: false, distance: null, reason: 'LOS_BLOCKED' };
    }
  }

  private undirectedKey(a: number, b: number) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  /** Simplified raycast for diagnostics only (doesn't block on failures) */
  private async raycastFaceDistance(
    viewer: any,
    A: BollardInfo,
    B: BollardInfo,
    axis: Axis
  ): Promise<number | null> {
    try {
      const unitScale = viewer.model.getUnitScale();
      const eps = 1 /*mm*/ / 1000 / unitScale;

      const dir = new THREE.Vector3(0, 0, 0);
      dir[axis] = B.center[axis] - A.center[axis] >= 0 ? +1 : -1;

      const ortho: Axis = axis === 'x' ? 'y' : 'x';
      const origin = A.center.clone();
      origin[axis] += (A.size[axis] / 2 + eps * 2) * dir[axis];
      origin[ortho] = Math.max(
        A.bbox.min[ortho],
        Math.min(origin[ortho], A.bbox.max[ortho])
      );
      origin[ortho] = Math.max(
        B.bbox.min[ortho],
        Math.min(origin[ortho], B.bbox.max[ortho])
      );
      origin.z =
        (Math.max(A.bbox.min.z, B.bbox.min.z) +
          Math.min(A.bbox.max.z, B.bbox.max.z)) /
        2;

      const ray = new THREE.Raycaster(origin, dir);

      const cast = (rc: any) => {
        const m: any = viewer.model as any;
        if (typeof m.rayIntersect === 'function')
          return m.rayIntersect(rc, false);
        const impl: any = viewer.impl as any;
        if (typeof impl.rayIntersect === 'function')
          return impl.rayIntersect(rc, false);
        return null;
      };

      const hits = cast(ray);
      if (!hits) return null;
      const list = Array.isArray(hits) ? hits : [hits];
      if (!list.length) return null;

      // Find first hit on B
      const hitOnB = list.find((h) => h.dbId === B.dbId);
      return hitOnB && typeof hitOnB.distance === 'number'
        ? hitOnB.distance
        : null;
    } catch {
      return null;
    }
  }
}
