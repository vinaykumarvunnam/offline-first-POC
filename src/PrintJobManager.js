class PrintJobManager {
  constructor(dataStore) {
    this.ds = dataStore;
    this.queue = [];
    this.isPrinting = false;
    this.printDestinations = ['receipt', 'kitchen', 'bar'];
    this.templates = {
      receipt: (order) =>
        `Receipt\nOrder: ${order.id}\n${order.items
          .map((i) => `${i.qty}x ${i.name} - $${(i.qty * i.price).toFixed(2)}`)
          .join('\n')}\n\nTotal: $${order.total.toFixed(2)}\n`,
      kitchen: (order) =>
        `Kitchen Slip\nOrder: ${order.id}\n${order.items
          .map((i) => `${i.qty}x ${i.name} ${i.customization ? '- ' + JSON.stringify(i.customization) : ''}`)
          .join('\n')}\n\nSpecial: ${order.items
          .filter((i) => i.specialRequest)
          .map((i) => i.specialRequest)
          .join('; ')}\n`,
      bar: (order) =>
        `Bar Slip\nOrder: ${order.id}\n${order.items
          .filter(i => i.category === 'Drink')
          .map((i) => `${i.qty}x ${i.name}`)
          .join('\n')}\n`
    };
    this.RETRY_DELAY = 3000;
    this.MAX_RETRIES = 5;

    // Restore persisted print jobs on startup
    this._restoreQueue();
  }

  async _restoreQueue() {
    // Load incomplete/failed jobs from storage (simulate persistence)
    const jobs = await this.ds.getAll('printJobs');
    // Jobs that are not marked 'done'
    this.queue = jobs.filter(j => j.status !== 'done');
    this._processNext();
  }

  // Add a print job for a given destination (receipt, kitchen, bar)
  async addJob(destination, order, priority = 1) {
    if (!this.printDestinations.includes(destination)) throw new Error("Invalid print destination");

    const job = {
      id: Date.now().toString() + Math.random(),
      destination,
      orderId: order.id,
      payload: order,
      template: destination,
      status: 'queued',
      priority,
      createdAt: new Date().toISOString(),
      tries: 0
    };
    await this.ds.put('printJobs', job);
    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority); // Highest priority first
    this._processNext();
  }

  // Process jobs in the print queue one by one
  async _processNext() {
    if (this.isPrinting || this.queue.length === 0) return;
    this.isPrinting = true;
    const job = this.queue.shift();

    try {
      await this._print(job);
      job.status = 'done';
      await this.ds.put('printJobs', job);
      this._notify('Print job succeeded', job);
    } catch (err) {
      job.status = 'failed';
      job.tries = (job.tries || 0) + 1;
      await this.ds.put('printJobs', job);
      this._notify('Print job failed, will retry', job);

      if (job.tries < this.MAX_RETRIES) {
        setTimeout(() => {
          this.queue.unshift(job); // Retry at same priority
          this._processNext();
        }, this.RETRY_DELAY * job.tries);
        this.isPrinting = false;
        return;
      } else {
        this._notify('Print job abandoned after max retries', job);
      }
    }
    this.isPrinting = false;
    this._processNext();
  }

  // Actual print function (stub for ESC/POS command logic)
  async _print(job) {
    // Format using the right template
    const formatFn = this.templates[job.template];
    const formatted = formatFn ? formatFn(job.payload) : JSON.stringify(job.payload);
    // Here, you would convert `formatted` to ESC/POS commands and send to the printer.
    // For demo, we'll simulate success and a small delay:
    await new Promise((res) => setTimeout(res, 800));
    // Simulate error on demand:
    // if (Math.random() < 0.2) throw new Error("Printer offline");
    return true;
  }

  // User notification (could tie to UI event, snackbar, etc)
  _notify(message, job) {
    console.log(`[PrintJobManager] ${message}:`, job.destination, job.orderId);
    // Hook for UI: e.g. showToast(message)
    if (this.onStatus) this.onStatus(message, job);
  }

  // Optionally for UI: assign a listener
  setStatusCallback(cb) {
    this.onStatus = cb;
  }
}
