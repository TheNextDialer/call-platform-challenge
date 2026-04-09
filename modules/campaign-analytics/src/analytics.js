/**
 * Campaign Metrics Engine
 *
 * Tracks contact events through a campaign funnel and computes
 * conversion rates, drop-off rates, time-to-convert, and full funnel reports.
 */

const { Funnel } = require('./funnel');

class CampaignAnalytics {
  /**
   * @param {Funnel} funnel - The funnel definition to analyze against
   */
  constructor(funnel) {
    if (!(funnel instanceof Funnel)) {
      throw new Error('A Funnel instance is required');
    }
    this.funnel = funnel;
    this.events = [];
  }

  /**
   * Record a campaign event.
   * @param {{ contactId: string, step: number, timestamp: string|Date, type: 'entered'|'completed'|'dropped' }} event
   *
   * BUG: Does not deduplicate — same contactId + step + type added twice will be counted twice.
   */
  addEvent(event) {
    if (!event.contactId || !event.step || !event.timestamp || !event.type) {
      throw new Error('Event must have contactId, step, timestamp, and type');
    }
    const validTypes = ['entered', 'completed', 'dropped'];
    if (!validTypes.includes(event.type)) {
      throw new Error(`Invalid event type: ${event.type}`);
    }
    if (!this.funnel.hasStep(event.step)) {
      throw new Error(`Step ${event.step} does not exist in funnel`);
    }
    this.events.push({
      ...event,
      timestamp: new Date(event.timestamp),
    });
    return this;
  }

  /**
   * Get the conversion rate between two funnel steps.
   *
   * BUG: Denominator uses total contacts who entered ANY step,
   * not those who completed the fromStep.
   */
  getConversionRate(fromStep, toStep) {
    if (!this.funnel.hasStep(fromStep) || !this.funnel.hasStep(toStep)) {
      throw new Error('Both steps must exist in the funnel');
    }

    // BUG: Should count contacts who completed fromStep, but instead
    // counts all contacts who entered any step (total pool)
    const totalEntered = this.events
      .filter(e => e.type === 'entered')
      .map(e => e.contactId);
    const uniqueEntered = new Set(totalEntered);

    const completedToStep = this.events
      .filter(e => e.step === toStep && e.type === 'completed')
      .map(e => e.contactId);
    const uniqueCompleted = new Set(completedToStep);

    if (uniqueEntered.size === 0) return 0;
    return uniqueCompleted.size / uniqueEntered.size;
  }

  /**
   * Get the drop-off rate at a specific step.
   *
   * BUG: Counts contacts who entered but haven't completed or dropped
   * (i.e. still in progress) as "dropped". Should only count explicit drops.
   */
  getDropOffRate(step) {
    if (!this.funnel.hasStep(step)) {
      throw new Error(`Step ${step} does not exist in funnel`);
    }

    const enteredContacts = new Set(
      this.events
        .filter(e => e.step === step && e.type === 'entered')
        .map(e => e.contactId)
    );

    const completedContacts = new Set(
      this.events
        .filter(e => e.step === step && e.type === 'completed')
        .map(e => e.contactId)
    );

    // BUG: "dropped" here means anyone who entered but didn't complete,
    // which includes in-progress contacts. Should only count explicit 'dropped' events.
    const droppedCount = [...enteredContacts].filter(
      id => !completedContacts.has(id)
    ).length;

    if (enteredContacts.size === 0) return 0;
    return droppedCount / enteredContacts.size;
  }

  /**
   * Get the average time to convert between two steps.
   *
   * BUG: Measures from the contact's first touch (step 1 entered)
   * instead of from the fromStep completed timestamp.
   */
  getTimeToConvert(fromStep, toStep) {
    if (!this.funnel.hasStep(fromStep) || !this.funnel.hasStep(toStep)) {
      throw new Error('Both steps must exist in the funnel');
    }

    const completedToStep = this.events.filter(
      e => e.step === toStep && e.type === 'completed'
    );

    if (completedToStep.length === 0) return null;

    let totalMs = 0;
    let count = 0;

    for (const completion of completedToStep) {
      // BUG: Uses the first 'entered' event for this contact (typically step 1)
      // instead of the 'completed' event for fromStep
      const firstTouch = this.events.find(
        e => e.contactId === completion.contactId && e.type === 'entered'
      );

      if (firstTouch) {
        totalMs += completion.timestamp - firstTouch.timestamp;
        count++;
      }
    }

    if (count === 0) return null;
    return totalMs / count;
  }

  /**
   * Generate a full funnel report, optionally filtered by date range.
   *
   * BUG: Date range end comparison uses `>` instead of `>=`,
   * which excludes events on the last day.
   */
  getReport(dateRange) {
    let filteredEvents = this.events;

    if (dateRange) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);

      filteredEvents = this.events.filter(e => {
        // BUG: end comparison uses `<` instead of `<=`, excluding events at exact end timestamp
        return e.timestamp >= start && e.timestamp < end;
      });
    }

    const steps = this.funnel.getSteps();
    const report = {
      funnelName: this.funnel.name,
      generatedAt: new Date().toISOString(),
      dateRange: dateRange || null,
      steps: [],
      totalContacts: 0,
      overallConversion: 0,
    };

    const allContacts = new Set(
      filteredEvents.map(e => e.contactId)
    );
    report.totalContacts = allContacts.size;

    for (const step of steps) {
      const stepEvents = filteredEvents.filter(e => e.step === step.stepNumber);
      const entered = new Set(
        stepEvents.filter(e => e.type === 'entered').map(e => e.contactId)
      );
      const completed = new Set(
        stepEvents.filter(e => e.type === 'completed').map(e => e.contactId)
      );
      const dropped = new Set(
        stepEvents.filter(e => e.type === 'dropped').map(e => e.contactId)
      );

      report.steps.push({
        stepNumber: step.stepNumber,
        name: step.name,
        entered: entered.size,
        completed: completed.size,
        dropped: dropped.size,
        completionRate: entered.size > 0 ? completed.size / entered.size : 0,
      });
    }

    if (report.steps.length >= 2) {
      const firstStep = report.steps[0];
      const lastStep = report.steps[report.steps.length - 1];
      report.overallConversion =
        firstStep.entered > 0 ? lastStep.completed / firstStep.entered : 0;
    }

    return report;
  }

  /**
   * Get all events for a specific contact.
   * @param {string} contactId
   */
  getContactJourney(contactId) {
    return this.events
      .filter(e => e.contactId === contactId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get unique contact count across all events.
   */
  getUniqueContactCount() {
    return new Set(this.events.map(e => e.contactId)).size;
  }
}

module.exports = { CampaignAnalytics };
