import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { isFlowCasePage, extractFlowCaseContent } from '@/lib/site-extractors/flowcase';

function createDocument(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

describe('FlowCase Extractor', () => {
  describe('isFlowCasePage', () => {
    it('detects FlowCase pages by cvpartner assets', () => {
      const doc = createDocument(`
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="https://assets.cvpartner.com/packs/css/vendors.css">
          </head>
          <body>
            <div id="dashboard"></div>
          </body>
        </html>
      `);
      expect(isFlowCasePage(doc)).toBe(true);
    });

    it('detects FlowCase pages by modal_cv class', () => {
      const doc = createDocument(`
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="https://assets.cvpartner.com/styles.css">
          </head>
          <body>
            <div class="modal_cv"></div>
          </body>
        </html>
      `);
      expect(isFlowCasePage(doc)).toBe(true);
    });

    it('returns false for regular pages', () => {
      const doc = createDocument(`
        <!DOCTYPE html>
        <html>
          <head><title>Regular Page</title></head>
          <body><article><p>Content</p></article></body>
        </html>
      `);
      expect(isFlowCasePage(doc)).toBe(false);
    });
  });

  describe('extractFlowCaseContent', () => {
    it('extracts person name and title', () => {
      const doc = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div class="modal_cv">
              <div class="main_container">
                <div id="details">
                  <fieldset>
                    <ul>
                      <li class="name"><h2>John Doe</h2></li>
                      <li class="title"><h2>Senior Developer</h2></li>
                      <li><label>telefon</label><span>+47 123 456 789</span></li>
                      <li><label>epost</label><span>john@example.com</span></li>
                    </ul>
                  </fieldset>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);

      const result = extractFlowCaseContent(doc);
      
      expect(result).not.toBeNull();
      expect(result?.title).toBe('CV - John Doe');
      expect(result?.author).toBe('John Doe');
      expect(result?.blocks.length).toBeGreaterThan(0);
      
      // Check for name heading
      const nameBlock = result?.blocks.find(b => b.type === 'heading' && b.content === 'John Doe');
      expect(nameBlock).toBeDefined();
      
      // Check for title
      const titleBlock = result?.blocks.find(b => b.type === 'paragraph' && b.content === 'Senior Developer');
      expect(titleBlock).toBeDefined();
      
      // Check for contact info
      const contactBlock = result?.blocks.find(b => 
        b.type === 'paragraph' && 
        b.content.includes('telefon') && 
        b.content.includes('epost')
      );
      expect(contactBlock).toBeDefined();
    });

    it('extracts key qualifications section', () => {
      const doc = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div class="modal_cv">
              <div class="main_container">
                <div id="details">
                  <fieldset>
                    <ul>
                      <li class="name"><h2>Jane Smith</h2></li>
                    </ul>
                  </fieldset>
                </div>
                <div id="key_qualifications">
                  <h2>Sammendrag av kvalifikasjoner</h2>
                  <ul id="key_qualifications_list">
                    <li>
                      <fieldset>
                        <div class="basicInfo">
                          <div class="fieldWrapper"><div>Technical Leadership</div></div>
                        </div>
                        <div class="long_description_wrapper">
                          <div class="long_description">
                            <div class="splitted_string">
                              <span>Experienced technical leader with 10 years in software development.</span>
                              <span>Specializes in cloud architecture and team management.</span>
                            </div>
                          </div>
                        </div>
                        <div class="key_points_wrapper">
                          <ul>
                            <li><div class="subsection_wrapper"><div class="fieldWrapper subsection_name"><div>Cloud Architecture</div></div></div></li>
                            <li><div class="subsection_wrapper"><div class="fieldWrapper subsection_name"><div>Team Leadership</div></div></div></li>
                          </ul>
                        </div>
                      </fieldset>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);

      const result = extractFlowCaseContent(doc);
      
      expect(result).not.toBeNull();
      
      // Check for qualifications section heading
      const sectionHeading = result?.blocks.find(b => 
        b.type === 'heading' && b.content === 'Sammendrag av kvalifikasjoner'
      );
      expect(sectionHeading).toBeDefined();
      
      // Check for description paragraphs
      const descPara = result?.blocks.find(b => 
        b.type === 'paragraph' && b.content.includes('technical leader')
      );
      expect(descPara).toBeDefined();
      
      // Check for key points list
      const keyPointsList = result?.blocks.find(b => 
        b.type === 'list' && 
        b.items?.includes('Cloud Architecture')
      );
      expect(keyPointsList).toBeDefined();
    });

    it('extracts project experiences with dates and roles', () => {
      const doc = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div class="modal_cv">
              <div class="main_container">
                <div id="details">
                  <fieldset>
                    <ul><li class="name"><h2>Test User</h2></li></ul>
                  </fieldset>
                </div>
                <div id="project_experiences">
                  <h2>Prosjekterfaring</h2>
                  <ul id="project_experiences_list">
                    <li>
                      <fieldset>
                        <div class="basicInfo">
                          <div class="dateCollector">
                            <div class="from_dates">
                              <div class="fieldWrapper monthWrapper month_from"><div class="month_input">Jan</div></div>
                              <div class="fieldWrapper yearWrapper year_from"><div class="year_input">2023</div></div>
                            </div>
                            <div class="to_dates">
                              <div class="fieldWrapper monthWrapper month_to"><div class="month_input">Dec</div></div>
                              <div class="fieldWrapper yearWrapper year_to"><div class="year_input">2023</div></div>
                            </div>
                          </div>
                          <div class="fieldWrapper primary_field"><div>Acme Corp</div></div>
                          <div class="fieldWrapper secondary_field"><div>Data Platform Migration</div></div>
                          <div class="fieldWrapper meta_field"><div> | Technology</div></div>
                        </div>
                        <div class="long_description_wrapper">
                          <div class="long_description">
                            <div class="splitted_string">
                              <span>Led the migration of legacy data infrastructure to modern cloud platform.</span>
                            </div>
                          </div>
                        </div>
                        <div class="roles_wrapper">
                          <ul>
                            <li>
                              <div class="subsection_wrapper">
                                <div class="fieldWrapper subsection_name"><div>Solution Architect</div></div>
                                <div class="long_description_wrapper">
                                  <div class="long_description">
                                    <div class="splitted_string">
                                      <span>Designed the target architecture and migration strategy.</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </li>
                          </ul>
                        </div>
                        <ul class="block_section">
                          <div class="skill_read_only"><span class="skill_read_only_value">Azure</span></div>
                          <div class="skill_read_only"><span class="skill_read_only_value">Databricks</span></div>
                        </ul>
                      </fieldset>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);

      const result = extractFlowCaseContent(doc);
      
      expect(result).not.toBeNull();
      
      // Check for project heading with dates
      const projectHeading = result?.blocks.find(b => 
        b.type === 'heading' && 
        b.content.includes('Acme Corp') && 
        b.content.includes('Jan 2023') &&
        b.content.includes('Dec 2023')
      );
      expect(projectHeading).toBeDefined();
      
      // Check for role heading
      const roleHeading = result?.blocks.find(b => 
        b.type === 'heading' && b.content.includes('Solution Architect')
      );
      expect(roleHeading).toBeDefined();
      
      // Check for skills
      const skillsPara = result?.blocks.find(b => 
        b.type === 'paragraph' && 
        b.content.includes('Azure') && 
        b.content.includes('Databricks')
      );
      expect(skillsPara).toBeDefined();
    });

    it('skips disabled sections', () => {
      const doc = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div class="modal_cv">
              <div class="main_container">
                <div id="details">
                  <fieldset>
                    <ul><li class="name"><h2>Test User</h2></li></ul>
                  </fieldset>
                </div>
                <div id="project_experiences">
                  <ul id="project_experiences_list">
                    <li class="disabled_section">
                      <fieldset>
                        <div class="basicInfo">
                          <div class="fieldWrapper primary_field"><div>Hidden Project</div></div>
                        </div>
                      </fieldset>
                    </li>
                    <li>
                      <fieldset>
                        <div class="basicInfo">
                          <div class="fieldWrapper primary_field"><div>Visible Project</div></div>
                        </div>
                      </fieldset>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);

      const result = extractFlowCaseContent(doc);
      
      expect(result).not.toBeNull();
      
      // Should NOT contain hidden project
      const hiddenProject = result?.blocks.find(b => 
        b.content?.includes('Hidden Project')
      );
      expect(hiddenProject).toBeUndefined();
      
      // Should contain visible project
      const visibleProject = result?.blocks.find(b => 
        b.content?.includes('Visible Project')
      );
      expect(visibleProject).toBeDefined();
    });

    it('returns null when no CV content found', () => {
      const doc = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div>No CV content here</div>
          </body>
        </html>
      `);

      const result = extractFlowCaseContent(doc);
      expect(result).toBeNull();
    });
  });
});
