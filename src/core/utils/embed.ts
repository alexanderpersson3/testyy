import { EmbedOptions } from '../types/sharing.js';;

/**
 * Generate HTML embed code for a recipe
 */
export function generateEmbedCode(url: string, options: EmbedOptions = {}): string {
  const {
    width = '100%',
    height = '600px',
    theme = 'light',
    showImage = true,
    showDescription = true,
    showIngredients = true,
    showInstructions = true,
    showMetadata = true,
    responsive = true,
  } = options;

  // Build query parameters for options
  const params = new URLSearchParams({
    theme,
    showImage: showImage.toString(),
    showDescription: showDescription.toString(),
    showIngredients: showIngredients.toString(),
    showInstructions: showInstructions.toString(),
    showMetadata: showMetadata.toString(),
  });

  // Generate the embed URL
  const embedUrl = `${url}/embed?${params.toString()}`;

  // Generate responsive wrapper if needed
  const responsiveWrapper = responsive
    ? `
      <div style="
        position: relative;
        padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
        height: 0;
        overflow: hidden;
      ">
        {{iframe}}
      </div>
    `
    : '{{iframe}}';

  // Generate iframe with specified dimensions
  const iframe = `
    <iframe
      src="${embedUrl}"
      width="${width}"
      height="${height}"
      frameborder="0"
      allowfullscreen
      style="${responsive ? 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;' : ''}"
    ></iframe>
  `;

  // Return the complete embed code
  return responsiveWrapper.replace('{{iframe}}', iframe).trim();
}

/**
 * Generate CSS for embedded recipe widget
 */
export function generateEmbedStyles(theme: 'light' | 'dark' = 'light'): string {
  const colors =
    theme === 'light'
      ? {
          background: '#ffffff',
          text: '#333333',
          border: '#e0e0e0',
          accent: '#4CAF50',
        }
      : {
          background: '#1a1a1a',
          text: '#ffffff',
          border: '#333333',
          accent: '#4CAF50',
        };

  return `
    .recipe-embed {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: ${colors.text};
      background: ${colors.background};
      padding: 20px;
      border-radius: 8px;
      border: 1px solid ${colors.border};
    }

    .recipe-embed img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }

    .recipe-embed h1 {
      font-size: 24px;
      margin: 0 0 16px;
      color: ${colors.accent};
    }

    .recipe-embed h2 {
      font-size: 18px;
      margin: 24px 0 12px;
      color: ${colors.accent};
    }

    .recipe-embed .description {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }

    .recipe-embed .metadata {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      padding: 12px;
      background: ${theme === 'light' ? '#f5f5f5' : '#2a2a2a'};
      border-radius: 4px;
    }

    .recipe-embed .metadata div {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .recipe-embed .metadata label {
      font-size: 12px;
      color: ${theme === 'light' ? '#666666' : '#999999'};
    }

    .recipe-embed .metadata span {
      font-size: 14px;
      font-weight: 500;
    }

    .recipe-embed .ingredients {
      margin-bottom: 24px;
    }

    .recipe-embed .ingredients ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .recipe-embed .ingredients li {
      padding: 8px 0;
      border-bottom: 1px solid ${colors.border};
      font-size: 14px;
    }

    .recipe-embed .instructions {
      margin-bottom: 24px;
    }

    .recipe-embed .instructions ol {
      padding-left: 24px;
      margin: 0;
    }

    .recipe-embed .instructions li {
      margin-bottom: 16px;
      font-size: 14px;
      line-height: 1.6;
    }

    .recipe-embed .footer {
      font-size: 12px;
      color: ${theme === 'light' ? '#666666' : '#999999'};
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid ${colors.border};
    }

    .recipe-embed .footer a {
      color: ${colors.accent};
      text-decoration: none;
    }

    .recipe-embed .footer a:hover {
      text-decoration: underline;
    }
  `;
}
