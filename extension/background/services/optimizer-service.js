/**
 * Service for finding optimal ticket splits using dynamic programming
 */
export class OptimizerService {
  /**
   * Find optimal split of segments
   * @param {Array} segments - All priced segments
   * @param {number} nodeCount - Number of nodes in route
   * @param {Function} progressCallback - Progress callback
   * @returns {Object} Optimal split or error
   */
  async findOptimalSplit(segments, nodeCount, progressCallback) {
    const validSegments = segments.filter((s) => s?.bestOffer?.amount != null);

    await progressCallback({
      phase: "dp-start",
      validSegments: validSegments.length,
    });

    if (nodeCount < 2) {
      return { error: "insufficient-nodes" };
    }

    const cost = this.buildCostMatrix(validSegments);
    const segmentMap = this.buildSegmentMap(validSegments);
    const { dp, prev } = this.runDynamicProgramming(cost, nodeCount);

    if (dp[nodeCount - 1] === Infinity) {
      await progressCallback({ phase: "dp-done", error: "no-path-found" });
      return {
        error: "no-path-found",
        totalValidSegments: validSegments.length,
        nodeCount,
      };
    }

    const chosen = this.reconstructPath(prev, nodeCount - 1, segmentMap);
    const totalCost = chosen.reduce((sum, seg) => sum + seg.amount, 0);

    await progressCallback({
      phase: "dp-done",
      segmentsUsed: chosen.length,
      totalCost,
    });

    return {
      total: totalCost,
      currency: "EUR",
      segments: chosen,
      dpCost: dp[nodeCount - 1],
      validSegmentsUsed: chosen.length,
      totalValidSegments: validSegments.length,
    };
  }

  /**
   * Build cost matrix from segments
   * @param {Array} segments - Valid segments
   * @returns {Map} Cost matrix
   */
  buildCostMatrix(segments) {
    const cost = new Map();

    for (const s of segments) {
      if (
        s?.bestOffer?.amount != null &&
        s.fromIdx != null &&
        s.toIdx != null
      ) {
        const key = `${s.fromIdx}-${s.toIdx}`;
        cost.set(key, s.bestOffer.amount);
      }
    }

    return cost;
  }

  /**
   * Build segment lookup map
   * @param {Array} segments - Valid segments
   * @returns {Map} Segment map
   */
  buildSegmentMap(segments) {
    const segmentMap = new Map();

    for (const s of segments) {
      if (
        s?.bestOffer?.amount != null &&
        s.fromIdx != null &&
        s.toIdx != null
      ) {
        const key = `${s.fromIdx}-${s.toIdx}`;
        segmentMap.set(key, s);
      }
    }

    return segmentMap;
  }

  /**
   * Run dynamic programming algorithm
   * @param {Map} cost - Cost matrix
   * @param {number} n - Number of nodes
   * @returns {Object} DP arrays
   */
  runDynamicProgramming(cost, n) {
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

    console.debug(
      `[DP] processing ${n} nodes with ${cost.size} valid segments`,
    );

    return { dp, prev };
  }

  /**
   * Reconstruct optimal path
   * @param {Array} prev - Previous node array
   * @param {number} end - End node index
   * @param {Map} segmentMap - Segment lookup map
   * @returns {Array} Chosen segments
   */
  reconstructPath(prev, end, segmentMap) {
    const chosen = [];
    let cur = end;

    while (cur > 0 && prev[cur] >= 0) {
      const i = prev[cur];
      const j = cur;
      const key = `${i}-${j}`;
      const segment = segmentMap.get(key);

      if (segment) {
        chosen.push({
          fromIdx: i,
          toIdx: j,
          amount: segment.bestOffer.amount,
          currency: segment.bestOffer.currency || "EUR",
          from: segment.from,
          to: segment.to,
        });
      }

      cur = i;
    }

    chosen.reverse();

    console.debug(
      `[DP] found solution: ${chosen.length} segments, total cost ${chosen.reduce((s, seg) => s + seg.amount, 0)}`,
    );

    return chosen;
  }
}
