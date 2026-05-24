import {
  App,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  normalizePath,
} from "obsidian";

// ── Types ────────────────────────────────────────────────────────────────────

interface ResearchHubSettings {
  researchFolder: string;
}

const DEFAULT_SETTINGS: ResearchHubSettings = {
  researchFolder: "Research",
};

interface ResearchProject {
  name: string;
  question: string;
  hypothesis: string;
  folderPath: string;
  sourceCount: number;
  claimCount: number;
  synthesisCount: number;
}

// ── Sidebar View ─────────────────────────────────────────────────────────────

const RESEARCH_HUB_VIEW_TYPE = "research-hub-view";

class ResearchHubView extends ItemView {
  plugin: ResearchHubPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: ResearchHubPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return RESEARCH_HUB_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Research Hub";
  }

  getIcon(): string {
    return "microscope";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("research-hub-view");

    const header = container.createDiv("research-hub-header");
    header.createEl("h4", { text: "Research Hub" });
    const actions = header.createDiv("research-hub-actions");

    const newBtn = actions.createEl("button", {
      text: "+ New Project",
      cls: "research-hub-btn primary",
    });
    newBtn.addEventListener("click", () => {
      new NewProjectModal(this.app, this.plugin, () => this.render()).open();
    });

    const refreshBtn = actions.createEl("button", {
      text: "↻",
      cls: "research-hub-btn",
      attr: { title: "Refresh" },
    });
    refreshBtn.addEventListener("click", () => this.render());

    const projects = await this.loadProjects();
    const listEl = container.createDiv("research-hub-project-list");

    if (projects.length === 0) {
      const empty = listEl.createDiv("research-hub-empty");
      empty.createDiv({ cls: "empty-icon", text: "🔬" });
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
          text: `Q: ${project.question}`,
        });
      }

      const stats = item.createDiv("research-hub-project-stats");
      this.createStat(stats, "📄", project.sourceCount, "Sources");
      this.createStat(stats, "💡", project.claimCount, "Claims");
      this.createStat(stats, "📝", project.synthesisCount, "Synthesis");

      item.addEventListener("click", async () => {
        const folderPath = project.folderPath;
        const files = this.app.vault.getFiles().filter((f) =>
          f.path.startsWith(folderPath + "/")
        );
        if (files.length > 0) {
          await this.app.workspace.openLinkText(files[0].path, "", false);
        } else {
          new Notice(`Project folder: ${folderPath}`);
        }
      });
    }
  }

  createStat(container: HTMLElement, icon: string, count: number, label: string): void {
    const stat = container.createDiv("research-hub-stat");
    stat.createSpan({ cls: "research-hub-stat-icon", text: icon });
    stat.createSpan({ text: `${count} ${label}` });
  }

  async loadProjects(): Promise<ResearchProject[]> {
    const base = this.plugin.settings.researchFolder;
    const projects: ResearchProject[] = [];
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(base));
    if (!folder) return projects;

    const allFiles = this.app.vault.getFiles();

    // Find all project subdirectories by looking at file paths
    const projectNames = new Set<string>();
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
      const sourceCount = allFiles.filter((f) =>
        f.path.startsWith(`${folderPath}/Sources/`)
      ).length;
      const claimCount = allFiles.filter((f) =>
        f.path.startsWith(`${folderPath}/Claims/`)
      ).length;
      const synthesisCount = allFiles.filter((f) =>
        f.path.startsWith(`${folderPath}/Synthesis/`)
      ).length;

      // Try to read question/hypothesis from project index note
      let question = "";
      let hypothesis = "";
      const indexFile = allFiles.find(
        (f) => f.path === `${folderPath}/${name}.md`
      );
      if (indexFile) {
        const content = await this.app.vault.read(indexFile);
        const qMatch = content.match(/\*\*Research Question\*\*:\s*(.+)/);
        const hMatch = content.match(/\*\*Hypothesis\*\*:\s*(.+)/);
        if (qMatch) question = qMatch[1].trim();
        if (hMatch) hypothesis = hMatch[1].trim();
      }

      projects.push({
        name,
        question,
        hypothesis,
        folderPath,
        sourceCount,
        claimCount,
        synthesisCount,
      });
    }

    return projects.sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ── New Project Modal ─────────────────────────────────────────────────────────

class NewProjectModal extends Modal {
  plugin: ResearchHubPlugin;
  onComplete: () => void;
  topic = "";
  question = "";
  hypothesis = "";

  constructor(app: App, plugin: ResearchHubPlugin, onComplete: () => void) {
    super(app);
    this.plugin = plugin;
    this.onComplete = onComplete;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Research Project" });

    new Setting(contentEl)
      .setName("Topic / Title")
      .setDesc("Name of the research project")
      .addText((t) => {
        t.setPlaceholder("e.g. Climate Change Impacts")
          .onChange((v) => (this.topic = v.trim()));
        t.inputEl.style.width = "100%";
        setTimeout(() => t.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName("Research Question")
      .setDesc("The central question you are investigating")
      .addText((t) => {
        t.setPlaceholder("e.g. How does X affect Y?")
          .onChange((v) => (this.question = v.trim()));
        t.inputEl.style.width = "100%";
      });

    new Setting(contentEl)
      .setName("Hypothesis")
      .setDesc("Your initial hypothesis or expected answer")
      .addText((t) => {
        t.setPlaceholder("e.g. I believe X will cause Y because...")
          .onChange((v) => (this.hypothesis = v.trim()));
        t.inputEl.style.width = "100%";
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Create Project")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  async submit(): Promise<void> {
    if (!this.topic) {
      new Notice("Please enter a topic/title.");
      return;
    }

    const base = this.plugin.settings.researchFolder;
    const projectPath = `${base}/${this.topic}`;
    const subfolders = ["Sources", "Claims", "Synthesis"];

    try {
      // Create folder structure
      for (const sub of subfolders) {
        const path = normalizePath(`${projectPath}/${sub}`);
        if (!this.app.vault.getAbstractFileByPath(path)) {
          await this.app.vault.createFolder(path);
        }
      }

      // Create project index note
      const indexPath = normalizePath(`${projectPath}/${this.topic}.md`);
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
          "",
        ].join("\n");

        const file = await this.app.vault.create(indexPath, content);
        await this.app.workspace.openLinkText(file.path, "", false);
      }

      new Notice(`Research project "${this.topic}" created.`);
      this.onComplete();
      this.close();
    } catch (err) {
      new Notice(`Error creating project: ${err}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── New Source Modal ──────────────────────────────────────────────────────────

class NewSourceModal extends Modal {
  plugin: ResearchHubPlugin;

  constructor(app: App, plugin: ResearchHubPlugin) {
    super(app);
    this.plugin = plugin;
  }

  private project = "";
  private title = "";
  private url = "";
  private keyFinding = "";
  private credibility: "high" | "medium" | "low" = "medium";

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Add Source" });

    const projects = this.getProjects();
    if (projects.length === 0) {
      contentEl.createEl("p", {
        text: "No research projects found. Create a project first.",
      });
      new Setting(contentEl).addButton((btn) =>
        btn.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }

    new Setting(contentEl)
      .setName("Project")
      .setDesc("Which research project does this source belong to?")
      .addDropdown((dd) => {
        for (const p of projects) dd.addOption(p, p);
        this.project = projects[0];
        dd.onChange((v) => (this.project = v));
      });

    new Setting(contentEl)
      .setName("Source Title")
      .setDesc("Title of the book, article, paper, or website")
      .addText((t) => {
        t.setPlaceholder("e.g. The Great Gatsby")
          .onChange((v) => (this.title = v.trim()));
        t.inputEl.style.width = "100%";
        setTimeout(() => t.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName("URL / Reference")
      .setDesc("URL, ISBN, DOI, or citation")
      .addText((t) => {
        t.setPlaceholder("https://... or Author, Year")
          .onChange((v) => (this.url = v.trim()));
        t.inputEl.style.width = "100%";
      });

    new Setting(contentEl)
      .setName("Key Finding")
      .setDesc("The most important takeaway from this source")
      .addTextArea((t) => {
        t.setPlaceholder("Main argument or finding...")
          .onChange((v) => (this.keyFinding = v.trim()));
        t.inputEl.style.width = "100%";
        t.inputEl.rows = 3;
      });

    new Setting(contentEl)
      .setName("Credibility")
      .setDesc("How credible is this source?")
      .addDropdown((dd) => {
        dd.addOption("high", "High — Peer-reviewed / authoritative");
        dd.addOption("medium", "Medium — Reputable but not primary");
        dd.addOption("low", "Low — Anecdotal / unverified");
        dd.setValue("medium");
        dd.onChange((v) => (this.credibility = v as "high" | "medium" | "low"));
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Add Source")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  getProjects(): string[] {
    const base = this.plugin.settings.researchFolder;
    const names = new Set<string>();
    for (const file of this.app.vault.getFiles()) {
      if (file.path.startsWith(base + "/")) {
        const relative = file.path.slice(base.length + 1);
        const parts = relative.split("/");
        if (parts.length >= 2) names.add(parts[0]);
      }
    }
    return Array.from(names).sort();
  }

  async submit(): Promise<void> {
    if (!this.title) {
      new Notice("Please enter a source title.");
      return;
    }
    if (!this.project) {
      new Notice("Please select a project.");
      return;
    }

    const base = this.plugin.settings.researchFolder;
    const sourcesPath = normalizePath(
      `${base}/${this.project}/Sources/${this.title}.md`
    );

    if (this.app.vault.getAbstractFileByPath(sourcesPath)) {
      new Notice("A source with that title already exists.");
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
      "",
    ]
      .filter((l) => l !== undefined)
      .join("\n");

    try {
      const folder = normalizePath(`${base}/${this.project}/Sources`);
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      const file = await this.app.vault.create(sourcesPath, content);
      await this.app.workspace.openLinkText(file.path, "", false);
      new Notice(`Source "${this.title}" added to ${this.project}.`);
      this.close();
    } catch (err) {
      new Notice(`Error: ${err}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── New Claim Modal ───────────────────────────────────────────────────────────

class NewClaimModal extends Modal {
  plugin: ResearchHubPlugin;
  private project = "";
  private assertion = "";
  private sources = "";
  private confidence: "high" | "medium" | "low" = "medium";

  constructor(app: App, plugin: ResearchHubPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Claim" });

    const projects = this.getProjects();
    if (projects.length === 0) {
      contentEl.createEl("p", { text: "No research projects found." });
      new Setting(contentEl).addButton((btn) =>
        btn.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }

    new Setting(contentEl)
      .setName("Project")
      .addDropdown((dd) => {
        for (const p of projects) dd.addOption(p, p);
        this.project = projects[0];
        dd.onChange((v) => (this.project = v));
      });

    new Setting(contentEl)
      .setName("Assertion")
      .setDesc("The claim or argument being made")
      .addTextArea((t) => {
        t.setPlaceholder("e.g. X causes Y under conditions Z")
          .onChange((v) => (this.assertion = v.trim()));
        t.inputEl.style.width = "100%";
        t.inputEl.rows = 3;
        setTimeout(() => t.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName("Supporting Sources")
      .setDesc("Comma-separated source titles that support this claim")
      .addText((t) => {
        t.setPlaceholder("Source A, Source B")
          .onChange((v) => (this.sources = v.trim()));
        t.inputEl.style.width = "100%";
      });

    new Setting(contentEl)
      .setName("Confidence")
      .setDesc("How confident are you in this claim?")
      .addDropdown((dd) => {
        dd.addOption("high", "High");
        dd.addOption("medium", "Medium");
        dd.addOption("low", "Low");
        dd.setValue("medium");
        dd.onChange((v) => (this.confidence = v as "high" | "medium" | "low"));
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Save Claim")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  getProjects(): string[] {
    const base = this.plugin.settings.researchFolder;
    const names = new Set<string>();
    for (const file of this.app.vault.getFiles()) {
      if (file.path.startsWith(base + "/")) {
        const relative = file.path.slice(base.length + 1);
        const parts = relative.split("/");
        if (parts.length >= 2) names.add(parts[0]);
      }
    }
    return Array.from(names).sort();
  }

  async submit(): Promise<void> {
    if (!this.assertion) {
      new Notice("Please enter an assertion.");
      return;
    }
    if (!this.project) {
      new Notice("Please select a project.");
      return;
    }

    const base = this.plugin.settings.researchFolder;
    const timestamp = Date.now();
    const safeTitle = this.assertion.slice(0, 40).replace(/[\\/:*?"<>|]/g, "-");
    const claimPath = normalizePath(
      `${base}/${this.project}/Claims/${safeTitle}.md`
    );

    const date = new Date().toISOString().split("T")[0];
    const sourceLinks = this.sources
      ? this.sources
          .split(",")
          .map((s) => `- [[${s.trim()}]]`)
          .join("\n")
      : "_No sources linked._";

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
      "",
    ].join("\n");

    try {
      const folder = normalizePath(`${base}/${this.project}/Claims`);
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      const file = await this.app.vault.create(claimPath, content);
      await this.app.workspace.openLinkText(file.path, "", false);
      new Notice(`Claim saved in ${this.project}.`);
      this.close();
    } catch (err) {
      new Notice(`Error: ${err}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── New Synthesis Modal ───────────────────────────────────────────────────────

class NewSynthesisModal extends Modal {
  plugin: ResearchHubPlugin;
  private project = "";
  private title = "";
  private conclusion = "";

  constructor(app: App, plugin: ResearchHubPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Synthesis Note" });

    const projects = this.getProjects();
    if (projects.length === 0) {
      contentEl.createEl("p", { text: "No research projects found." });
      new Setting(contentEl).addButton((btn) =>
        btn.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }

    new Setting(contentEl)
      .setName("Project")
      .addDropdown((dd) => {
        for (const p of projects) dd.addOption(p, p);
        this.project = projects[0];
        dd.onChange((v) => (this.project = v));
      });

    new Setting(contentEl)
      .setName("Synthesis Title")
      .addText((t) => {
        t.setPlaceholder("e.g. Conclusion on X")
          .onChange((v) => (this.title = v.trim()));
        t.inputEl.style.width = "100%";
        setTimeout(() => t.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName("Conclusion")
      .setDesc("What conclusion have you drawn from the sources?")
      .addTextArea((t) => {
        t.setPlaceholder("Based on the evidence, I conclude...")
          .onChange((v) => (this.conclusion = v.trim()));
        t.inputEl.style.width = "100%";
        t.inputEl.rows = 5;
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Create Synthesis")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  getProjects(): string[] {
    const base = this.plugin.settings.researchFolder;
    const names = new Set<string>();
    for (const file of this.app.vault.getFiles()) {
      if (file.path.startsWith(base + "/")) {
        const relative = file.path.slice(base.length + 1);
        const parts = relative.split("/");
        if (parts.length >= 2) names.add(parts[0]);
      }
    }
    return Array.from(names).sort();
  }

  async submit(): Promise<void> {
    if (!this.title) {
      new Notice("Please enter a synthesis title.");
      return;
    }
    if (!this.project) {
      new Notice("Please select a project.");
      return;
    }

    const base = this.plugin.settings.researchFolder;
    const synthPath = normalizePath(
      `${base}/${this.project}/Synthesis/${this.title}.md`
    );

    if (this.app.vault.getAbstractFileByPath(synthPath)) {
      new Notice("A synthesis note with that title already exists.");
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
      "",
    ].join("\n");

    try {
      const folder = normalizePath(`${base}/${this.project}/Synthesis`);
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      const file = await this.app.vault.create(synthPath, content);
      await this.app.workspace.openLinkText(file.path, "", false);
      new Notice(`Synthesis note "${this.title}" created.`);
      this.close();
    } catch (err) {
      new Notice(`Error: ${err}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

class ResearchHubSettingTab extends PluginSettingTab {
  plugin: ResearchHubPlugin;

  constructor(app: App, plugin: ResearchHubPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Research Hub Settings" });

    new Setting(containerEl)
      .setName("Research folder")
      .setDesc(
        "Vault folder where all research projects are stored. Default: Research"
      )
      .addText((text) =>
        text
          .setPlaceholder("Research")
          .setValue(this.plugin.settings.researchFolder)
          .onChange(async (value) => {
            this.plugin.settings.researchFolder = value.trim() || "Research";
            await this.plugin.saveSettings();
          })
      );
  }
}

// ── Main Plugin ───────────────────────────────────────────────────────────────

export default class ResearchHubPlugin extends Plugin {
  settings!: ResearchHubSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register sidebar view
    this.registerView(
      RESEARCH_HUB_VIEW_TYPE,
      (leaf) => new ResearchHubView(leaf, this)
    );

    // Ribbon icon
    this.addRibbonIcon("microscope", "Research Hub", () => {
      this.activateSidebar();
    });

    // Commands
    this.addCommand({
      id: "open-research-hub",
      name: "Open Research Hub sidebar",
      callback: () => this.activateSidebar(),
    });

    this.addCommand({
      id: "new-research-project",
      name: "New Research Project",
      callback: () => {
        new NewProjectModal(this.app, this, () =>
          this.refreshSidebar()
        ).open();
      },
    });

    this.addCommand({
      id: "add-source",
      name: "Add Source to Research Project",
      callback: () => {
        new NewSourceModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: "new-claim",
      name: "New Claim in Research Project",
      callback: () => {
        new NewClaimModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: "new-synthesis",
      name: "New Synthesis Note",
      callback: () => {
        new NewSynthesisModal(this.app, this).open();
      },
    });

    this.addSettingTab(new ResearchHubSettingTab(this.app, this));
  }

  async activateSidebar(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(RESEARCH_HUB_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: RESEARCH_HUB_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async refreshSidebar(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(RESEARCH_HUB_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view as ResearchHubView;
      await view.render();
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(RESEARCH_HUB_VIEW_TYPE);
  }
}
