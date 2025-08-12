export class OptimizerService {
  async findOptimalSplit(segments: any[], nodeCount: number, progressCallback: (p: any) => Promise<void>) {
    const validSegments = segments.filter((s) => s?.bestOffer?.amount != null);
    await progressCallback({ phase: 'dp-start', validSegments: validSegments.length });
    if (nodeCount < 2) return { error: 'insufficient-nodes' } as const;
    const cost = this.buildCostMatrix(validSegments);
    const segmentMap = this.buildSegmentMap(validSegments);
    const { dp, prev } = this.runDynamicProgramming(cost, nodeCount);
    if (dp[nodeCount - 1] === Infinity) {
      await progressCallback({ phase: 'dp-done', error: 'no-path-found' });
      return { error: 'no-path-found', totalValidSegments: validSegments.length, nodeCount } as const;
    }
    const chosen = this.reconstructPath(prev, nodeCount - 1, segmentMap);
    const totalCost = chosen.reduce((sum, seg) => sum + seg.amount, 0);
    await progressCallback({ phase: 'dp-done', segmentsUsed: chosen.length, totalCost });
    return { total: totalCost, currency: 'EUR', segments: chosen, dpCost: dp[nodeCount - 1], validSegmentsUsed: chosen.length, totalValidSegments: validSegments.length } as const;
  }

  buildCostMatrix(segments: any[]) {
    const cost = new Map<string, number>();
    for (const s of segments) {
      if (s?.bestOffer?.amount != null && s.fromIdx != null && s.toIdx != null) {
        cost.set(`${s.fromIdx}-${s.toIdx}`, s.bestOffer.amount);
      }
    }
    return cost;
  }

  buildSegmentMap(segments: any[]) {
    const segmentMap = new Map<string, any>();
    for (const s of segments) {
      if (s?.bestOffer?.amount != null && s.fromIdx != null && s.toIdx != null) {
        segmentMap.set(`${s.fromIdx}-${s.toIdx}`, s);
      }
    }
    return segmentMap;
  }

  runDynamicProgramming(cost: Map<string, number>, n: number) {
    const INF = 1e15;
    const dp = Array(n).fill(INF);
    const prev = Array(n).fill(-1);
    dp[0] = 0;
    for (let j = 1; j < n; j++) {
      for (let i = 0; i < j; i++) {
        const c = cost.get(`${i}-${j}`);
        if (c != null && dp[i] + c < dp[j]) {
          dp[j] = dp[i] + c;
          prev[j] = i;
        }
      }
    }
    return { dp, prev };
  }

  reconstructPath(prev: number[], end: number, segmentMap: Map<string, any>) {
    const chosen: any[] = [];
    let cur = end;
    while (cur > 0 && prev[cur] >= 0) {
      const i = prev[cur];
      const j = cur;
      const seg = segmentMap.get(`${i}-${j}`);
      if (seg) {
        chosen.push({ fromIdx: i, toIdx: j, amount: seg.bestOffer.amount, currency: seg.bestOffer.currency || 'EUR', from: seg.from, to: seg.to });
      }
      cur = i;
    }
    chosen.reverse();
    return chosen;
  }
}

