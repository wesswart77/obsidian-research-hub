var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ResearchHubPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  researchFolder: "Research"
};
var RESEARCH_HUB_VIEW_TYPE = "research-hub-view";
var ResearchHubView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return RESEARCH_HUB_VIEW_TYPE;
  }
  getDisplayText() {
    return "Research Hub";
  }
  getIcon() {
    return "microscope";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("research-hub-view");
    const header = container.createDiv("research-hub-header");
    header.createEl("h4", { text: "Research Hub" });
    const actions = header.createDiv("research-hub-actions");
    const newBtn = actions.createEl("button", {
      text: "+ New Project",
      cls: "research-hub-btn primary"
    });
    newBtn.addEventListener("click", () => {
      new NewProjectModal(this.app, this.plugin, () => this.render()).open();
    });
    const refreshBtn = actions.createEl("button", {
      text: "\u21BB",
      cls: "research-hub-btn",
      attr: { title: "Refresh" }
    });
    refreshBtn.addEventListener("click", () => this.render());
    const projects = await this.loadProjects();
    const listEl = container.createDiv("research-hub-project-list");
    if (projects.length === 0) {
      const empty = listEl.createDiv("research-hub-empty");
      empty.createDiv({ cls: "empty-icon", text: "\u{1F52C}" });
      empty.createEl("p", { text: "No research projects yet." });
      empty.createEl("p", { text: 'Click "+ New Project" to start.' });
      return;
    }
    for (const project of projects) {
      const item = listEl.createDiv("research-hub-project-item");
      item.createDiv({ cls: "research-hub-project-name", text: project.name });
      if (project.question) {
        item.createDiv({
          cls: "research-hub-project-question",
          text: `Q: ${project.question}`
        });
      }
      const stats = item.createDiv("research-hub-project-stats");
      this.createStat(stats, "\u{1F4C4}", project.sourceCount, "Sources");
      this.createStat(stats, "\u{1F4A1}", project.claimCount, "Claims");
      this.createStat(stats, "\u{1F4DD}", project.synthesisCount, "Synthesis");
      item.addEventListener("click", async () => {
        const folderPath = project.folderPath;
        const files = this.app.vault.getFiles().filter(
          (f) => f.path.startsWith(folderPath + "/")
        );
        if (files.length > 0) {
          await this.app.workspace.openLinkText(files[0].path, "", false);
        } else {
          new import_obsidian.Notice(`Project folder: ${folderPath}`);
        }
      });
    }
  }
  createStat(container, icon, count, label) {
    const stat = container.createDiv("research-hub-stat");
    stat.createSpan({ cls: "research-hub-stat-icon", text: icon });
    stat.createSpan({ text: `${count} ${label}` });
  }
  async loadProjects() {
    const base = this.plugin.settings.researchFolder;
    const projects = [];
    const folder = this.app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(base));
    if (!folder)
      return projects;
    const allFiles = this.app.vault.getFiles();
    const projectNames = /* @__PURE__ */ new Set();
    for (const file of allFiles) {
      if (file.path.startsWith(base + "/")) {
        const relative = file.path.slice(base.length + 1);
        const parts = relative.split("/");
        if (parts.length >= 2) {
          projectNames.add(parts[0]);
        }
      }
    }
    for (const name of projectNames) {
      const folderPath = `${base}/${name}`;
      const sourceCount = allFiles.filter(
        (f) => f.path.startsWith(`${folderPath}/Sources/`)
      ).length;
      const claimCount = allFiles.filter(
        (f) => f.path.startsWith(`${folderPath}/Claims/`)
      ).length;
      const synthesisCount = allFiles.filter(
        (f) => f.path.startsWith(`${folderPath}/Synthesis/`)
      ).length;
      let question = "";
      let hypothesis = "";
      const indexFile = allFiles.find(
        (f) => f.path === `${folderPath}/${name}.md`
      );
      if (indexFile) {
        const content = await this.app.vault.read(indexFile);
        const qMatch = content.match(/\*\*Research Question\*\*:\s*(.+)/);
        const hMatch = content.match(/\*\*Hypothesis\*\*:\s*(.+)/);
        if (qMatch)
          question = qMatch[1].trim();
        if (hMatch)
          hypothesis = hMatch[1].trim();
      }
      projects.push({
        name,
        question,
        hypothesis,
        folderPath,
        sourceCount,
        claimCount,
        synthesisCount
      });
    }
    return projects.sort((a, b) => a.name.localeCompare(b.name));
  }
};
var NewProjectModal = class extends import_obsidian.Modal {
  constructor(app, plugin, onComplete) {
    super(app);
    this.topic = "";
    this.question = "";
    this.hypothesis = "";
    this.plugin = plugin;
    this.onComplete = onComplete;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Research Project" });
    new import_obsidian.Setting(contentEl).setName("Topic / Title").setDesc("Name of the research project").addText((t) => {
      t.setPlaceholder("e.g. Climate Change Impacts").onChange((v) => this.topic = v.trim());
      t.inputEl.style.width = "100%";
      setTimeout(() => t.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("Research Question").setDesc("The central question you are investigating").addText((t) => {
      t.setPlaceholder("e.g. How does X affect Y?").onChange((v) => this.question = v.trim());
      t.inputEl.style.width = "100%";
    });
    new import_obsidian.Setting(contentEl).setName("Hypothesis").setDesc("Your initial hypothesis or expected answer").addText((t) => {
      t.setPlaceholder("e.g. I believe X will cause Y because...").onChange((v) => this.hypothesis = v.trim());
      t.inputEl.style.width = "100%";
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Create Project").setCta().onClick(() => this.submit())
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  async submit() {
    if (!this.topic) {
      new import_obsidian.Notice("Please enter a topic/title.");
      return;
    }
    const base = this.plugin.settings.researchFolder;
    const projectPath = `${base}/${this.topic}`;
    const subfolders = ["Sources", "Claims", "Synthesis"];
    try {
      for (const sub of subfolders) {
        const path = (0, import_obsidian.normalizePath)(`${projectPath}/${sub}`);
        if (!this.app.vault.getAbstractFileByPath(path)) {
          await this.app.vault.createFolder(path);
        }
      }
      const indexPath = (0, import_obsidian.normalizePath)(`${projectPath}/${this.topic}.md`);
      if (!this.app.vault.getAbstractFileByPath(indexPath)) {
        const content = [
          `# ${this.topic}`,
          "",
          `**Research Question**: ${this.question || "TBD"}`,
          `**Hypothesis**: ${this.hypothesis || "TBD"}`,
          `**Created**: ${new Date().toISOString().split("T")[0]}`,
          "",
          "## Overview",
          "",
          "## Key Sources",
          "",
          "## Main Claims",
          "",
          "## Synthesis",
          "",
          "## Conclusions",
          ""
        ].join("\n");
        const file = await this.app.vault.create(indexPath, content);
        await this.app.workspace.openLinkText(file.path, "", false);
      }
      new import_obsidian.Notice(`Research project "${this.topic}" created.`);
      this.onComplete();
      this.close();
    } catch (err) {
      new import_obsidian.Notice(`Error creating project: ${err}`);
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var NewSourceModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.project = "";
    this.title = "";
    this.url = "";
    this.keyFinding = "";
    this.credibility = "medium";
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Add Source" });
    const projects = this.getProjects();
    if (projects.length === 0) {
      contentEl.createEl("p", {
        text: "No research projects found. Create a project first."
      });
      new import_obsidian.Setting(contentEl).addButton(
        (btn) => btn.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }
    new import_obsidian.Setting(contentEl).setName("Project").setDesc("Which research project does this source belong to?").addDropdown((dd) => {
      for (const p of projects)
        dd.addOption(p, p);
      this.project = projects[0];
      dd.onChange((v) => this.project = v);
    });
    new import_obsidian.Setting(contentEl).setName("Source Title").setDesc("Title of the book, article, paper, or website").addText((t) => {
      t.setPlaceholder("e.g. The Great Gatsby").onChange((v) => this.title = v.trim());
      t.inputEl.style.width = "100%";
      setTimeout(() => t.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("URL / Reference").setDesc("URL, ISBN, DOI, or citation").addText((t) => {
      t.setPlaceholder("https://... or Author, Year").onChange((v) => this.url = v.trim());
      t.inputEl.style.width = "100%";
    });
    new import_obsidian.Setting(contentEl).setName("Key Finding").setDesc("The most important takeaway from this source").addTextArea((t) => {
      t.setPlaceholder("Main argument or finding...").onChange((v) => this.keyFinding = v.trim());
      t.inputEl.style.width = "100%";
      t.inputEl.rows = 3;
    });
    new import_obsidian.Setting(contentEl).setName("Credibility").setDesc("How credible is this source?").addDropdown((dd) => {
      dd.addOption("high", "High \u2014 Peer-reviewed / authoritative");
      dd.addOption("medium", "Medium \u2014 Reputable but not primary");
      dd.addOption("low", "Low \u2014 Anecdotal / unverified");
      dd.setValue("medium");
      dd.onChange((v) => this.credibility = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Add Source").setCta().onClick(() => this.submit())
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  getProjects() {
    const base = this.plugin.settings.researchFolder;
    const names = /* @__PURE__ */ new Set();
    for (const file of this.app.vault.getFiles()) {
      if (file.path.startsWith(base + "/")) {
        const relative = file.path.slice(base.length + 1);
        const parts = relative.split("/");
        if (parts.length >= 2)
          names.add(parts[0]);
      }
    }
    return Array.from(names).sort();
  }
  async submit() {
    if (!this.title) {
      new import_obsidian.Notice("Please enter a source title.");
      return;
    }
    if (!this.project) {
      new import_obsidian.Notice("Please select a project.");
      return;
    }
    const base = this.plugin.settings.researchFolder;
    const sourcesPath = (0, import_obsidian.normalizePath)(
      `${base}/${this.project}/Sources/${this.title}.md`
    );
    if (this.app.vault.getAbstractFileByPath(sourcesPath)) {
      new import_obsidian.Notice("A source with that title already exists.");
      return;
    }
    const date = new Date().toISOString().split("T")[0];
    const content = [
      `# ${this.title}`,
      "",
      `**Type**: Source`,
      `**Project**: ${this.project}`,
      `**Credibility**: ${this.credibility}`,
      `**Date Added**: ${date}`,
      this.url ? `**Reference**: ${this.url}` : "",
      "",
      "## Key Finding",
      "",
      this.keyFinding || "_Add key finding here._",
      "",
      "## Notes",
      "",
      "## Quotes",
      ""
    ].filter((l) => l !== void 0).join("\n");
    try {
      const folder = (0, import_obsidian.normalizePath)(`${base}/${this.project}/Sources`);
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      const file = await this.app.vault.create(sourcesPath, content);
      await this.app.workspace.openLinkText(file.path, "", false);
      new import_obsidian.Notice(`Source "${this.title}" added to ${this.project}.`);
      this.close();
    } catch (err) {
      new import_obsidian.Notice(`Error: ${err}`);
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var NewClaimModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.project = "";
    this.assertion = "";
    this.sources = "";
    this.confidence = "medium";
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Claim" });
    const projects = this.getProjects();
    if (projects.length === 0) {
      contentEl.createEl("p", { text: "No research projects found." });
      new import_obsidian.Setting(contentEl).addButton(
        (btn) => btn.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }
    new import_obsidian.Setting(contentEl).setName("Project").addDropdown((dd) => {
      for (const p of projects)
        dd.addOption(p, p);
      this.project = projects[0];
      dd.onChange((v) => this.project = v);
    });
    new import_obsidian.Setting(contentEl).setName("Assertion").setDesc("The claim or argument being made").addTextArea((t) => {
      t.setPlaceholder("e.g. X causes Y under conditions Z").onChange((v) => this.assertion = v.trim());
      t.inputEl.style.width = "100%";
      t.inputEl.rows = 3;
      setTimeout(() => t.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("Supporting Sources").setDesc("Comma-separated source titles that support this claim").addText((t) => {
      t.setPlaceholder("Source A, Source B").onChange((v) => this.sources = v.trim());
      t.inputEl.style.width = "100%";
    });
    new import_obsidian.Setting(contentEl).setName("Confidence").setDesc("How confident are you in this claim?").addDropdown((dd) => {
      dd.addOption("high", "High");
      dd.addOption("medium", "Medium");
      dd.addOption("low", "Low");
      dd.setValue("medium");
      dd.onChange((v) => this.confidence = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save Claim").setCta().onClick(() => this.submit())
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  getProjects() {
    const base = this.plugin.settings.researchFolder;
    const names = /* @__PURE__ */ new Set();
    for (const file of this.app.vault.getFiles()) {
      if (file.path.startsWith(base + "/")) {
        const relative = file.path.slice(base.length + 1);
        const parts = relative.split("/");
        if (parts.length >= 2)
          names.add(parts[0]);
      }
    }
    return Array.from(names).sort();
  }
  async submit() {
    if (!this.assertion) {
      new import_obsidian.Notice("Please enter an assertion.");
      return;
    }
    if (!this.project) {
      new import_obsidian.Notice("Please select a project.");
      return;
    }
    const base = this.plugin.settings.researchFolder;
    const timestamp = Date.now();
    const safeTitle = this.assertion.slice(0, 40).replace(/[\\/:*?"<>|]/g, "-");
    const claimPath = (0, import_obsidian.normalizePath)(
      `${base}/${this.project}/Claims/${safeTitle}.md`
    );
    const date = new Date().toISOString().split("T")[0];
    const sourceLinks = this.sources ? this.sources.split(",").map((s) => `- [[${s.trim()}]]`).join("\n") : "_No sources linked._";
    const content = [
      `# Claim: ${safeTitle}`,
      "",
      `**Project**: ${this.project}`,
      `**Confidence**: ${this.confidence}`,
      `**Date**: ${date}`,
      "",
      "## Assertion",
      "",
      this.assertion,
      "",
      "## Supporting Sources",
      "",
      sourceLinks,
      "",
      "## Counter-Evidence",
      "",
      "## Notes",
      ""
    ].join("\n");
    try {
      const folder = (0, import_obsidian.normalizePath)(`${base}/${this.project}/Claims`);
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      const file = await this.app.vault.create(claimPath, content);
      await this.app.workspace.openLinkText(file.path, "", false);
      new import_obsidian.Notice(`Claim saved in ${this.project}.`);
      this.close();
    } catch (err) {
      new import_obsidian.Notice(`Error: ${err}`);
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var NewSynthesisModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.project = "";
    this.title = "";
    this.conclusion = "";
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Synthesis Note" });
    const projects = this.getProjects();
    if (projects.length === 0) {
      contentEl.createEl("p", { text: "No research projects found." });
      new import_obsidian.Setting(contentEl).addButton(
        (btn) => btn.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }
    new import_obsidian.Setting(contentEl).setName("Project").addDropdown((dd) => {
      for (const p of projects)
        dd.addOption(p, p);
      this.project = projects[0];
      dd.onChange((v) => this.project = v);
    });
    new import_obsidian.Setting(contentEl).setName("Synthesis Title").addText((t) => {
      t.setPlaceholder("e.g. Conclusion on X").onChange((v) => this.title = v.trim());
      t.inputEl.style.width = "100%";
      setTimeout(() => t.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("Conclusion").setDesc("What conclusion have you drawn from the sources?").addTextArea((t) => {
      t.setPlaceholder("Based on the evidence, I conclude...").onChange((v) => this.conclusion = v.trim());
      t.inputEl.style.width = "100%";
      t.inputEl.rows = 5;
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Create Synthesis").setCta().onClick(() => this.submit())
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  getProjects() {
    const base = this.plugin.settings.researchFolder;
    const names = /* @__PURE__ */ new Set();
    for (const file of this.app.vault.getFiles()) {
      if (file.path.startsWith(base + "/")) {
        const relative = file.path.slice(base.length + 1);
        const parts = relative.split("/");
        if (parts.length >= 2)
          names.add(parts[0]);
      }
    }
    return Array.from(names).sort();
  }
  async submit() {
    if (!this.title) {
      new import_obsidian.Notice("Please enter a synthesis title.");
      return;
    }
    if (!this.project) {
      new import_obsidian.Notice("Please select a project.");
      return;
    }
    const base = this.plugin.settings.researchFolder;
    const synthPath = (0, import_obsidian.normalizePath)(
      `${base}/${this.project}/Synthesis/${this.title}.md`
    );
    if (this.app.vault.getAbstractFileByPath(synthPath)) {
      new import_obsidian.Notice("A synthesis note with that title already exists.");
      return;
    }
    const date = new Date().toISOString().split("T")[0];
    const content = [
      `# ${this.title}`,
      "",
      `**Project**: ${this.project}`,
      `**Type**: Synthesis`,
      `**Date**: ${date}`,
      "",
      "## Conclusion",
      "",
      this.conclusion || "_Add your conclusion here._",
      "",
      "## Supporting Claims",
      "",
      "## Implications",
      "",
      "## Further Research Needed",
      ""
    ].join("\n");
    try {
      const folder = (0, import_obsidian.normalizePath)(`${base}/${this.project}/Synthesis`);
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      const file = await this.app.vault.create(synthPath, content);
      await this.app.workspace.openLinkText(file.path, "", false);
      new import_obsidian.Notice(`Synthesis note "${this.title}" created.`);
      this.close();
    } catch (err) {
      new import_obsidian.Notice(`Error: ${err}`);
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ResearchHubSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Research Hub Settings" });
    new import_obsidian.Setting(containerEl).setName("Research folder").setDesc(
      "Vault folder where all research projects are stored. Default: Research"
    ).addText(
      (text) => text.setPlaceholder("Research").setValue(this.plugin.settings.researchFolder).onChange(async (value) => {
        this.plugin.settings.researchFolder = value.trim() || "Research";
        await this.plugin.saveSettings();
      })
    );
  }
};
var ResearchHubPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      RESEARCH_HUB_VIEW_TYPE,
      (leaf) => new ResearchHubView(leaf, this)
    );
    this.addRibbonIcon("microscope", "Research Hub", () => {
      this.activateSidebar();
    });
    this.addCommand({
      id: "open-research-hub",
      name: "Open Research Hub sidebar",
      callback: () => this.activateSidebar()
    });
    this.addCommand({
      id: "new-research-project",
      name: "New Research Project",
      callback: () => {
        new NewProjectModal(
          this.app,
          this,
          () => this.refreshSidebar()
        ).open();
      }
    });
    this.addCommand({
      id: "add-source",
      name: "Add Source to Research Project",
      callback: () => {
        new NewSourceModal(this.app, this).open();
      }
    });
    this.addCommand({
      id: "new-claim",
      name: "New Claim in Research Project",
      callback: () => {
        new NewClaimModal(this.app, this).open();
      }
    });
    this.addCommand({
      id: "new-synthesis",
      name: "New Synthesis Note",
      callback: () => {
        new NewSynthesisModal(this.app, this).open();
      }
    });
    this.addSettingTab(new ResearchHubSettingTab(this.app, this));
  }
  async activateSidebar() {
    var _a;
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(RESEARCH_HUB_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = (_a = workspace.getRightLeaf(false)) != null ? _a : workspace.getLeaf(true);
      await leaf.setViewState({ type: RESEARCH_HUB_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  async refreshSidebar() {
    const leaves = this.app.workspace.getLeavesOfType(RESEARCH_HUB_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      await view.render();
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(RESEARCH_HUB_VIEW_TYPE);
  }
};
