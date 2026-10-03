import 'dotenv/config';

export interface SonarIssue {
  key: string;
  rule: string;
  severity: string;
  component?: string;
  project?: string;
  message: string;
  line?: number;
  type?: string;
  status?: string;
}

export interface SonarIssuesResponse {
  total: number;
  issues: SonarIssue[];
}

export interface SonarMeasure {
  metric: string;
  value?: string;
}

export interface SonarMeasuresResponse {
  component?: {
    key: string;
    name?: string;
    measures?: SonarMeasure[];
  };
}

export interface SonarProject {
  key: string;
  name?: string;
  qualifier?: string;
}

export interface SonarProjectsResponse {
  components?: SonarProject[];
}

export class SonarService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    baseUrl = process.env.SONAR_HOST_URL ?? 'http://localhost:9000',
    token = process.env.SONAR_TOKEN ?? '',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;

    if (!this.token) {
      throw new Error(
        'SONAR_TOKEN is not defined. Please check your .env file.',
      );
    }
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const credentials = Buffer
      .from(`${this.token}:`)
      .toString('base64');

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Basic ${credentials}`,
    };

    console.log('\n=== SonarQube Request ===');
    console.log('URL:', url.toString());
    console.log('Token exists:', Boolean(this.token));

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const body = await response.text();

    console.log('Status:', response.status);

    if (!response.ok) {
      console.error('SonarQube response:', body);

      throw new Error(
        `SonarQube API error ${response.status}: ${body}`,
      );
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error(
        `SonarQube returned invalid JSON from ${endpoint}`,
      );
    }
  }

  async getIssues(
    projectKey: string,
  ): Promise<SonarIssuesResponse> {
    return this.request<SonarIssuesResponse>(
      '/api/issues/search',
      {
        componentKeys: projectKey,
        resolved: 'false',
        ps: '500',
      },
    );
  }

  async getMeasures(
    projectKey: string,
  ): Promise<SonarMeasuresResponse> {
    return this.request<SonarMeasuresResponse>(
      '/api/measures/component',
      {
        component: projectKey,
        metricKeys: [
          'bugs',
          'vulnerabilities',
          'code_smells',
          'security_hotspots',
          'coverage',
          'duplicated_lines_density',
          'lines',
          'ncloc',
          'reliability_rating',
          'security_rating',
          'sqale_rating',
        ].join(','),
      },
    );
  }

  async getProject(
    projectKey: string,
  ): Promise<SonarProjectsResponse> {
    return this.request<SonarProjectsResponse>(
      '/api/components/search',
      {
        qualifiers: 'TRK',
        q: projectKey,
      },
    );
  }
}