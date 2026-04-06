/**
 * Priority Queue for outbound call ordering.
 *
 * Leads are scored using a weighted formula:
 *   priority = (leadScore * 0.6) + (minutesWaiting * 0.4) + timezoneBonus
 *
 * timezoneBonus: +10 if the lead's local time is within business hours (9am–5pm), else 0.
 *
 * The queue should return the HIGHEST priority lead on dequeue.
 */

class PriorityQueue {
  constructor(nowFn = () => Date.now()) {
    this.heap = [];
    this.nowFn = nowFn;
  }

  get size() {
    return this.heap.length;
  }

  enqueue(lead) {
    // lead: { id, leadScore, enqueuedAt, utcOffsetHours }
    this.heap.push(lead);
    this._bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  _calculatePriority(lead) {
    const minutesWaiting = (this.nowFn() - lead.enqueuedAt) / 60000;

    const utcHour = new Date(this.nowFn()).getUTCHours();
    const localHour = ((utcHour - lead.utcOffsetHours) % 24 + 24) % 24;
    const timezoneBonus = (localHour >= 9 && localHour < 17) ? 10 : 0;

    return (lead.leadScore * 0.6) + timezoneBonus;
  }

  _compare(i, j) {
    const a = this._calculatePriority(this.heap[i]);
    const b = this._calculatePriority(this.heap[j]);
    return a - b; // positive if a > b
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._compare(i, parent) > 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  _sinkDown(i) {
    const length = this.heap.length;
    while (true) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < length && this._compare(left, largest) < 0) {
        largest = left;
      }
      if (right < length && this._compare(right, largest) < 0) {
        largest = right;
      }
      if (largest !== i) {
        [this.heap[i], this.heap[largest]] = [this.heap[largest], this.heap[i]];
        i = largest;
      } else {
        break;
      }
    }
  }
}

module.exports = { PriorityQueue };
