export interface PageHelpSection {
  heading: string;
  body: string;
  tips?: string[];
}

export interface PageHelpRelated {
  label: string;
  helpKey: string;
}

export interface PageHelpContent {
  eyebrow: string;
  title: string;
  intro: string;
  sections: PageHelpSection[];
  related?: PageHelpRelated[];
}

export const pageHelp: Record<string, PageHelpContent> = {
  dashboard: {
    eyebrow: 'Page · Dashboard',
    title: 'Dashboard',
    intro:
      'Your home base. Shows pass rate, projects, runs in flight, and recent activity at a glance.',
    sections: [
      {
        heading: 'What you see here',
        body:
          'The top tiles summarise your last 7 days: pass rate, total tests, today’s run count, and what’s running right now. The activity card lists each day with pass/fail counts.',
      },
      {
        heading: 'Common actions',
        body:
          'Use “New project” to start fresh, or “Analyze URLs” to jump to a project and run analysis. Click any recent run to drill into its results.',
        tips: [
          'The pass rate sparkline uses your real last-7-day data.',
          'Pass rate ≥ 90% turns the trend chip green.',
        ],
      },
    ],
    related: [
      { label: 'Projects', helpKey: 'projects' },
      { label: 'Runs', helpKey: 'runs' },
    ],
  },

  projects: {
    eyebrow: 'Page · Projects',
    title: 'Projects',
    intro:
      'A project is the unit of work. It holds your URLs, discovered pages, analysed elements, tests, and suites.',
    sections: [
      {
        heading: 'Creating a project',
        body:
          'Click “New project” and give it a name plus one starting URL. You can add more URLs later in the project’s URLs tab.',
      },
      {
        heading: 'How projects organise everything',
        body:
          'Tests and suites always belong to a project. Element libraries are scoped per project too — analysing the same URL in two projects gives you two element catalogues.',
        tips: [
          'You can delete a project to wipe its URLs, elements, tests, and suites in one cascade.',
        ],
      },
    ],
    related: [
      { label: 'Project details', helpKey: 'project-details' },
      { label: 'Tests', helpKey: 'tests' },
    ],
  },

  'project-details': {
    eyebrow: 'Page · Project',
    title: 'Project details',
    intro:
      'Manage one project. Tabs let you switch between URLs, the element library, authentication, and the discovered sitemap.',
    sections: [
      {
        heading: 'Tabs at a glance',
        body:
          'URLs — pages you want tested. Elements — every analysed element grouped by source page. Auth — credentials and storage state. Sitemap — discovered page graph.',
      },
      {
        heading: 'Common flow',
        body:
          'Add URLs → run discovery to find more pages → analyse → click into the Elements tab to inspect each element → switch to the Tests area to build a test.',
      },
    ],
    related: [
      { label: 'URLs tab', helpKey: 'project-urls' },
      { label: 'Elements tab', helpKey: 'project-elements' },
      { label: 'Auth tab', helpKey: 'project-auth' },
      { label: 'Sitemap tab', helpKey: 'project-sitemap' },
    ],
  },

  'project-urls': {
    eyebrow: 'Project · URLs',
    title: 'URLs',
    intro:
      'The pages you want to test. Add a URL once, then analyse it to harvest interactive elements.',
    sections: [
      {
        heading: 'Adding URLs',
        body:
          'Paste a full URL (with scheme), give it a title for your own reference, and save. Localhost URLs work — Docker uses host.docker.internal under the hood.',
      },
      {
        heading: 'Analyse vs Discover',
        body:
          '“Analyse” opens a single URL and harvests every interactive element. “Discover” crawls the URL and finds linked pages, which you can then analyse one by one.',
        tips: [
          'Sitemap.xml is skipped for localhost — discovery falls back to link crawling.',
          'You can re-analyse anytime; elements with the same selector are merged, not duplicated.',
        ],
      },
    ],
  },

  'project-elements': {
    eyebrow: 'Project · Elements',
    title: 'Element library',
    intro:
      'Everything we found on your pages. Each row is a clickable element with its selector, type, source page, and confidence.',
    sections: [
      {
        heading: 'Reading a row',
        body:
          'Preview shows what the element looks like. Selector is what Playwright will use. Confidence rates how stable that selector should be — high is uniqueness + a stable hook like data-testid or role.',
      },
      {
        heading: 'Click a row',
        body:
          'A side drawer opens with the screenshot, selector (copyable), and tests that use it. Use this to verify Nomation found the right thing.',
        tips: [
          'Re-running analyse on the same URL refreshes selectors; existing tests adopt the new selector.',
          'Tables and dropdowns get an “Open explorer” modal for cell-by-cell or option-by-option testing.',
        ],
      },
    ],
  },

  'project-auth': {
    eyebrow: 'Project · Auth',
    title: 'Authentication',
    intro:
      'Configure how Nomation logs into pages that need credentials, so analysis and tests can reach protected screens.',
    sections: [
      {
        heading: 'Setting up auth',
        body:
          'Click “Set up auth” and provide a login URL, username/password selectors, and credentials. Nomation runs the login once and captures the storage state (cookies + localStorage) for reuse.',
      },
      {
        heading: 'When sessions break',
        body:
          'If a test hits a login redirect mid-run, the captured state probably expired. Re-run the setup to refresh it. Stored credentials are encrypted on the server side.',
      },
    ],
  },

  'project-sitemap': {
    eyebrow: 'Project · Sitemap',
    title: 'Sitemap',
    intro:
      'A graph of every page Nomation discovered, including how they link to each other.',
    sections: [
      {
        heading: 'How discovery works',
        body:
          'From your starting URL, Nomation follows <a> links and clicks navigation menus to reveal hidden ones. It stops at the depth and page-count you choose (defaults: 3 deep, 100 pages).',
      },
      {
        heading: 'Promoting a page',
        body:
          'Find a page you want tested? Promote it to the URLs tab and run analysis on it. The sitemap stays as a reference of what else exists.',
        tips: [
          'Dense content sites (book listings, profiles) can over-fetch — set a lower max-pages.',
          'SPA routes that use pushState aren’t followed yet — only real <a href> links.',
        ],
      },
    ],
  },

  tests: {
    eyebrow: 'Page · Tests',
    title: 'Tests',
    intro:
      'All individual tests in this project. Each test is an ordered list of steps you can run, edit, or copy.',
    sections: [
      {
        heading: 'Creating a test',
        body:
          'Click “Create test”. The Test Builder opens with your project’s element library on the left. Click elements to add steps, edit values, then save.',
      },
      {
        heading: 'Running a test',
        body:
          'The Run button offers two modes — headed (you watch the browser) or headless (faster, runs in the background queue). Results are recorded either way.',
        tips: [
          'Local drafts persist in localStorage until you save — no work lost on refresh.',
          'AI Generate Tests is hidden behind a flag while Anthropic billing is wired up.',
        ],
      },
    ],
    related: [
      { label: 'Test builder', helpKey: 'test-builder' },
      { label: 'Test results', helpKey: 'test-results' },
    ],
  },

  'test-builder': {
    eyebrow: 'Page · Test builder',
    title: 'Test builder',
    intro:
      'The 60/40 split where you build a test. Element library on the left, your test steps on the right.',
    sections: [
      {
        heading: 'Adding steps',
        body:
          'Click any element in the library — its action picker opens on the right. Pick click / type / assert / etc., set a value if needed, and the step is added.',
      },
      {
        heading: 'Live picker',
        body:
          'Need an element that’s not in the library? Click “Live picker” to open a real browser and point at the element on the page. The selector comes back into your library automatically.',
        tips: [
          'Tables and dropdowns have an “Open explorer” button for cell-level / option-level steps.',
          'The Save button lives in the panel header — your work also auto-persists locally as a draft.',
          'Step types: click, doubleclick, rightclick, hover, type, clear, select, check, uncheck, upload, scroll, press, wait, assert.',
        ],
      },
    ],
  },

  'test-results': {
    eyebrow: 'Page · Test results',
    title: 'Test results',
    intro:
      'Every run of a single test, newest first. Click a run to see step-by-step pass/fail with screenshots and video.',
    sections: [
      {
        heading: 'Reading a run',
        body:
          'Each step is timestamped with its duration. Failed steps show the error and a screenshot. Headless runs record video on failure; headed runs don’t (you watched it live).',
      },
      {
        heading: 'Re-running',
        body:
          'Hit Run from the header to queue another execution. The page subscribes to /execution-progress and refreshes when the new run finishes.',
        tips: [
          'Videos are kept for failed runs only; passing-run videos are auto-deleted to save disk.',
        ],
      },
    ],
  },

  suites: {
    eyebrow: 'Page · Suites',
    title: 'Test suites',
    intro:
      'Groups of tests you run together. Use suites for regression sets, smoke tests, or anything you want to run as a batch.',
    sections: [
      {
        heading: 'Creating a suite',
        body:
          'Click “Create suite”, name it, then add tests from the project. Tests can belong to multiple suites — no duplication.',
      },
      {
        heading: 'Running a suite',
        body:
          'Pick headed or headless mode. The suite runs tests one after another. While it runs, a floating indicator appears bottom-right so you can leave the page.',
        tips: [
          'A suite is “passed” only if every test inside passed.',
          'You can minimise the suite-results modal and the indicator keeps you live-updated.',
        ],
      },
    ],
    related: [
      { label: 'Suite details', helpKey: 'suite-details' },
      { label: 'Suite results', helpKey: 'suite-results' },
    ],
  },

  'suite-details': {
    eyebrow: 'Page · Suite',
    title: 'Suite details',
    intro:
      'Manage one suite: which tests it contains, recent executions, and a Run button to fire it off.',
    sections: [
      {
        heading: 'Adding or removing tests',
        body:
          'Use the “Add tests” button to pick from the project’s tests list. Remove a test from the suite and it stays in the project — only the link is severed.',
      },
      {
        heading: 'Running and watching',
        body:
          'Run opens the mode picker. While running, you can navigate away — the suite-execution indicator keeps you in the loop.',
      },
    ],
  },

  'suite-results': {
    eyebrow: 'Page · Suite results',
    title: 'Suite results',
    intro:
      'Every execution of this suite, newest first. Each row shows how many tests passed and failed.',
    sections: [
      {
        heading: 'Drilling in',
        body:
          'Click a suite run to see each test inside it with its own pass/fail, screenshot, and video. Re-run failed tests individually if you want.',
      },
      {
        heading: 'Live updates',
        body:
          'When you trigger a new run, the page subscribes to progress events and the list updates as tests complete — no refresh needed.',
      },
    ],
  },

  runs: {
    eyebrow: 'Page · Runs',
    title: 'Runs',
    intro:
      'Every test run and suite run across this project, sorted newest first. The unified activity log.',
    sections: [
      {
        heading: 'Reading the table',
        body:
          'Each row is one execution. Type is test or suite. Pass/Fail shows the breakdown (suites only). Click the row to jump to that run’s results page.',
      },
      {
        heading: 'Filtering',
        body:
          'The pills at the top filter by type — all / test / suite. The current page is fetch-on-mount, so use the refresh button to pull the latest.',
        tips: [
          'For very large projects this client-aggregates per test + per suite — pagination + a backend endpoint is on the roadmap.',
        ],
      },
    ],
  },

  'profile-settings': {
    eyebrow: 'Settings · Profile',
    title: 'Profile',
    intro:
      'Your account: name, email, password, and a quick way to log out of every device.',
    sections: [
      {
        heading: 'Changing your password',
        body:
          'Enter your current password plus the new one. We re-hash and store it — your old password is never recoverable in plain text.',
      },
      {
        heading: 'Replaying onboarding',
        body:
          'Forgot the tour? The help drawer has a “Replay onboarding” link in its footer — it clears the seen-flag and launches the tour next time you land on the dashboard.',
      },
    ],
  },

  'notification-settings': {
    eyebrow: 'Settings · Notifications',
    title: 'Notifications',
    intro:
      'Decide when Nomation pings you — email or in-app — and which kinds of events qualify.',
    sections: [
      {
        heading: 'Channels',
        body:
          'In-app notifications appear in the bell menu. Email notifications go to your account email. Toggle each channel independently.',
      },
      {
        heading: 'Event types',
        body:
          'Test failed, suite finished, analysis complete, and team invitations. Each can be enabled per channel — keep noise low by sticking to “failed” events only.',
      },
    ],
  },
};
