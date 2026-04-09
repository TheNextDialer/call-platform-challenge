/**
 * Campaign Funnel Step Management
 *
 * Manages the ordered steps in a campaign funnel (e.g. Dialed -> Connected -> Pitched -> Closed).
 * Each step has a numeric position and a human-readable name.
 */

class Funnel {
  constructor(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Funnel name is required');
    }
    this.name = name;
    this.steps = new Map();
  }

  /**
   * Add a step to the funnel.
   * @param {number} stepNumber - Position in the funnel (1-based)
   * @param {string} name - Human-readable step name
   */
  addStep(stepNumber, name) {
    if (typeof stepNumber !== 'number' || stepNumber < 1) {
      throw new Error('Step number must be a positive integer');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Step name is required');
    }
    if (this.steps.has(stepNumber)) {
      throw new Error(`Step ${stepNumber} already exists`);
    }
    this.steps.set(stepNumber, { stepNumber, name });
    return this;
  }

  /**
   * Get all steps in the funnel.
   * BUG: Returns steps in Map insertion order, not sorted by stepNumber.
   * If step 3 is added before step 2, they come back [3, 2] instead of [2, 3].
   */
  getSteps() {
    return Array.from(this.steps.values());
  }

  /**
   * Get a specific step by its number.
   * @param {number} num - The step number to retrieve
   */
  getStep(num) {
    const step = this.steps.get(num);
    if (!step) {
      throw new Error(`Step ${num} not found`);
    }
    return step;
  }

  /**
   * Get the total number of steps in the funnel.
   */
  getStepCount() {
    return this.steps.size;
  }

  /**
   * Check if a step number exists in the funnel.
   * @param {number} num
   */
  hasStep(num) {
    return this.steps.has(num);
  }

  /**
   * Remove a step from the funnel.
   * @param {number} num
   */
  removeStep(num) {
    if (!this.steps.has(num)) {
      throw new Error(`Step ${num} not found`);
    }
    this.steps.delete(num);
    return this;
  }

  /**
   * Get the first step number in the funnel.
   */
  getFirstStep() {
    if (this.steps.size === 0) {
      throw new Error('Funnel has no steps');
    }
    const steps = this.getSteps();
    return steps[0].stepNumber;
  }

  /**
   * Get the last step number in the funnel.
   */
  getLastStep() {
    if (this.steps.size === 0) {
      throw new Error('Funnel has no steps');
    }
    const steps = this.getSteps();
    return steps[steps.length - 1].stepNumber;
  }
}

module.exports = { Funnel };
