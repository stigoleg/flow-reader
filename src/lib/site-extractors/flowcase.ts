/**
 * FlowCase/CVPartner Site-Specific Extractor
 * 
 * Extracts CV content from FlowCase (cvpartner.com) pages.
 * These are SPA pages with structured CV data in modal dialogs.
 */

import type { Block } from '@/types';

/**
 * Check if the document is a FlowCase/CVPartner page
 */
export function isFlowCasePage(doc: Document): boolean {
  // Check for CVPartner-specific elements
  const hasCVPartnerAssets = doc.querySelector('link[href*="cvpartner.com"]') !== null;
  const hasDashboard = doc.querySelector('#dashboard') !== null;
  const hasModalCV = doc.querySelector('.modal_cv') !== null;
  const hasCVPartnerInit = doc.documentElement.outerHTML.includes('cvpartner.init');
  
  return (hasCVPartnerAssets || hasCVPartnerInit) && (hasDashboard || hasModalCV);
}

/**
 * Extract person's name from the CV
 */
function extractPersonName(doc: Document): string | undefined {
  // Try the details section first
  const nameEl = doc.querySelector('#details .name h2, #details h2.name');
  if (nameEl?.textContent?.trim()) {
    return nameEl.textContent.trim();
  }
  
  // Try modal info
  const modalName = doc.querySelector('.modal_info .dropdown_container span[title]');
  if (modalName?.getAttribute('title')?.trim()) {
    return modalName.getAttribute('title')!.trim();
  }
  
  // Fallback to any h2 in details
  const detailsH2 = doc.querySelector('#details h2');
  return detailsH2?.textContent?.trim();
}

/**
 * Extract person's title/role
 */
function extractPersonTitle(doc: Document): string | undefined {
  const titleEl = doc.querySelector('#details .title h2, #details li.title h2');
  return titleEl?.textContent?.trim();
}

/**
 * Clean text content - remove excess whitespace and normalize
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ') // non-breaking spaces
    .trim();
}

/**
 * Extract text from a long_description element, preserving paragraph structure
 */
function extractDescription(container: Element): string[] {
  const paragraphs: string[] = [];
  
  // Look for splitted_string spans (FlowCase paragraph structure)
  const spans = container.querySelectorAll('.splitted_string > span');
  if (spans.length > 0) {
    spans.forEach(span => {
      const text = cleanText(span.textContent || '');
      // Skip empty spans and non-breaking space only spans
      if (text && text !== ' ' && text !== '\u00a0') {
        paragraphs.push(text);
      }
    });
  } else {
    // Fallback to raw text content
    const text = cleanText(container.textContent || '');
    if (text) {
      paragraphs.push(text);
    }
  }
  
  return paragraphs;
}

/**
 * Extract key points/bullet items from a section
 */
function extractKeyPoints(container: Element): string[] {
  const points: string[] = [];
  
  const keyPointsWrapper = container.querySelector('.key_points_wrapper');
  if (keyPointsWrapper) {
    const items = keyPointsWrapper.querySelectorAll('li .subsection_name div');
    items.forEach(item => {
      const text = cleanText(item.textContent || '');
      if (text) {
        points.push(text);
      }
    });
  }
  
  return points;
}

/**
 * Extract skills from a project
 */
function extractSkills(container: Element): string[] {
  const skills: string[] = [];
  
  const skillElements = container.querySelectorAll('.skill_read_only_value');
  skillElements.forEach(el => {
    const text = cleanText(el.textContent || '');
    if (text) {
      skills.push(text);
    }
  });
  
  return skills;
}

/**
 * Extract date range from a project/item
 */
function extractDateRange(container: Element): string {
  const parts: string[] = [];
  
  const monthFrom = container.querySelector('.month_from .month_input');
  const yearFrom = container.querySelector('.year_from .year_input');
  const monthTo = container.querySelector('.month_to .month_input');
  const yearTo = container.querySelector('.year_to .year_input');
  
  if (monthFrom?.textContent || yearFrom?.textContent) {
    const from = [monthFrom?.textContent, yearFrom?.textContent].filter(Boolean).join(' ');
    parts.push(from);
  }
  
  if (monthTo?.textContent || yearTo?.textContent) {
    const to = [monthTo?.textContent, yearTo?.textContent].filter(Boolean).join(' ');
    if (parts.length > 0) {
      parts.push('-');
    }
    parts.push(to);
  }
  
  return parts.join(' ');
}

/**
 * Extract a CV section (qualifications, projects, education, etc.)
 */
function extractSection(doc: Document, sectionId: string, sectionTitle: string): Block[] {
  const blocks: Block[] = [];
  const section = doc.querySelector(`#${sectionId}`);
  
  if (!section) {
    return blocks;
  }
  
  // Add section heading
  blocks.push({
    type: 'heading',
    content: sectionTitle,
    level: 2,
    id: `section-${sectionId}`,
  });
  
  // Get all list items (each is an entry in the section)
  const items = section.querySelectorAll(`#${sectionId}_list > li:not(.disabled_section)`);
  
  items.forEach((item, index) => {
    // Skip disabled/hidden sections
    if (item.classList.contains('disabled_section')) {
      return;
    }
    
    // Extract primary field (company name, school name, etc.)
    const primaryField = item.querySelector('.primary_field div');
    const secondaryField = item.querySelector('.secondary_field div');
    const metaField = item.querySelector('.meta_field div');
    
    const itemTitle = cleanText(primaryField?.textContent || '');
    const itemSubtitle = cleanText(secondaryField?.textContent || '');
    const itemMeta = cleanText(metaField?.textContent || '').replace(/^\s*\|\s*/, '');
    
    // Date range
    const dateRange = extractDateRange(item);
    
    // Build item heading
    const headingParts: string[] = [];
    if (itemTitle) headingParts.push(itemTitle);
    if (itemSubtitle && itemSubtitle !== '--') headingParts.push(`- ${itemSubtitle}`);
    
    if (headingParts.length > 0) {
      let heading = headingParts.join(' ');
      if (dateRange) {
        heading = `${heading} (${dateRange})`;
      }
      
      blocks.push({
        type: 'heading',
        content: heading,
        level: 3,
        id: `${sectionId}-item-${index}-heading`,
      });
    }
    
    // Add meta info if present
    if (itemMeta) {
      blocks.push({
        type: 'paragraph',
        content: itemMeta,
        id: `${sectionId}-item-${index}-meta`,
      });
    }
    
    // Extract main description
    const descriptionWrapper = item.querySelector('.long_description_wrapper .long_description');
    if (descriptionWrapper) {
      const paragraphs = extractDescription(descriptionWrapper);
      paragraphs.forEach((para, pIndex) => {
        blocks.push({
          type: 'paragraph',
          content: para,
          id: `${sectionId}-item-${index}-desc-${pIndex}`,
        });
      });
    }
    
    // Extract roles (for project experiences)
    const roles = item.querySelectorAll('.roles_wrapper li .subsection_wrapper');
    roles.forEach((role, roleIndex) => {
      const roleName = role.querySelector('.subsection_name div');
      if (roleName?.textContent?.trim()) {
        blocks.push({
          type: 'heading',
          content: `Rolle: ${cleanText(roleName.textContent)}`,
          level: 3,
          id: `${sectionId}-item-${index}-role-${roleIndex}`,
        });
      }
      
      const roleDesc = role.querySelector('.long_description');
      if (roleDesc) {
        const paragraphs = extractDescription(roleDesc);
        paragraphs.forEach((para, pIndex) => {
          blocks.push({
            type: 'paragraph',
            content: para,
            id: `${sectionId}-item-${index}-role-${roleIndex}-desc-${pIndex}`,
          });
        });
      }
    });
    
    // Extract key points
    const keyPoints = extractKeyPoints(item);
    if (keyPoints.length > 0) {
      blocks.push({
        type: 'list',
        items: keyPoints,
        ordered: false,
        id: `${sectionId}-item-${index}-keypoints`,
      });
    }
    
    // Extract skills
    const skills = extractSkills(item);
    if (skills.length > 0) {
      blocks.push({
        type: 'paragraph',
        content: `Kompetanse: ${skills.join(', ')}`,
        id: `${sectionId}-item-${index}-skills`,
      });
    }
  });
  
  return blocks;
}

/**
 * Extract contact details from the CV
 */
function extractContactDetails(doc: Document): Block[] {
  const blocks: Block[] = [];
  const details = doc.querySelector('#details fieldset ul');
  
  if (!details) {
    return blocks;
  }
  
  const items = details.querySelectorAll('li');
  const contactInfo: string[] = [];
  
  items.forEach(item => {
    // Skip name and title (handled separately)
    if (item.classList.contains('name') || item.classList.contains('title')) {
      return;
    }
    
    const label = item.querySelector('label');
    const value = item.querySelector('span');
    
    if (label?.textContent && value?.textContent) {
      const labelText = cleanText(label.textContent);
      const valueText = cleanText(value.textContent);
      contactInfo.push(`${labelText}: ${valueText}`);
    }
  });
  
  if (contactInfo.length > 0) {
    blocks.push({
      type: 'paragraph',
      content: contactInfo.join(' | '),
      id: 'contact-info',
    });
  }
  
  return blocks;
}

/**
 * Main FlowCase extraction function
 */
export function extractFlowCaseContent(doc: Document): { blocks: Block[]; title: string; author?: string } | null {
  // Verify this is a FlowCase page with CV content
  const cvContainer = doc.querySelector('.modal_cv .main_container, .modal_cv');
  if (!cvContainer) {
    return null;
  }
  
  const blocks: Block[] = [];
  
  // Extract person name and title
  const personName = extractPersonName(doc);
  const personTitle = extractPersonTitle(doc);
  
  // Add name as title heading
  if (personName) {
    blocks.push({
      type: 'heading',
      content: personName,
      level: 1,
      id: 'cv-title',
    });
  }
  
  // Add title/role
  if (personTitle) {
    blocks.push({
      type: 'paragraph',
      content: personTitle,
      id: 'cv-subtitle',
    });
  }
  
  // Extract contact details
  blocks.push(...extractContactDetails(doc));
  
  // Extract main CV sections
  const sections = [
    { id: 'key_qualifications', title: 'Sammendrag av kvalifikasjoner' },
    { id: 'project_experiences', title: 'Prosjekterfaring' },
    { id: 'work_experiences', title: 'Arbeidserfaring' },
    { id: 'educations', title: 'Utdanning' },
    { id: 'courses', title: 'Kurs' },
    { id: 'certifications', title: 'Sertifiseringer' },
    { id: 'technologies', title: 'Teknologier' },
    { id: 'languages', title: 'Språk' },
    { id: 'honors_awards', title: 'Priser og utmerkelser' },
    { id: 'presentations', title: 'Presentasjoner' },
    { id: 'blogs', title: 'Blogger og publikasjoner' },
  ];
  
  sections.forEach(({ id, title }) => {
    const sectionBlocks = extractSection(doc, id, title);
    blocks.push(...sectionBlocks);
  });
  
  // If no content was extracted, return null
  if (blocks.length <= 2) {
    return null;
  }
  
  return {
    blocks,
    title: personName ? `CV - ${personName}` : 'CV',
    author: personName,
  };
}
