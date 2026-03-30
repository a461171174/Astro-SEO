
import { GoogleGenAI, Type } from "@google/genai";
import { isAbortError } from "../utils";

export class GeminiService {
  private ai: GoogleGenAI;
  private model: string = "gemini-3-flash-preview";

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }

  setModel(modelName: string) {
    if (modelName) {
      this.model = modelName;
    }
  }

  getModel() {
    return this.model;
  }

  private async callWithRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (isAbortError(error)) throw error;
        
        const errorMessage = typeof error === 'string' ? error : error?.message || '';
        const isQuotaError = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
        const isSpendingCapError = errorMessage.includes('spending cap');

        if (isSpendingCapError) {
          throw new Error('Gemini API 额度已耗尽或超出支出上限。请在 Google AI Studio 中检查您的账单设置。');
        }

        if (isQuotaError && i < maxRetries) {
          const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
          console.warn(`Gemini Quota Exceeded. Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async analyzeInventory(products: any[]) {
    try {
      const prompt = `Analyze this product inventory and provide 3 brief strategic suggestions in Chinese. Focus on stock levels and categories. Products: ${JSON.stringify(products)}`;
      
      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                suggestion: { type: Type.STRING, description: "A strategic business suggestion." },
                category: { type: Type.STRING, description: "Relevant category." }
              },
              required: ["suggestion", "category"]
            }
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return [
        { suggestion: "建议优化服装类别的库存周转率。", category: "服装" },
        { suggestion: "宠物用品市场需求旺盛，可适当增加SKU。", category: "宠物用品" },
        { suggestion: "关注未分类产品的SEO优化。", category: "未分类" }
      ];
    }
  }

  async generateSEOSuggestions(
    product: any, 
    brandName: string = '', 
    strategy: string = '', 
    selectedKeywords: string[] = [],
    customPrompt?: string
  ) {
    try {
      const defaultPrompt = `Analyze this product and provide SEO optimization suggestions in Chinese. 
      ${brandName ? `Brand Name: ${brandName}` : ''}
      ${selectedKeywords.length > 0 ? `Core Keywords to prioritize: ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `SEO Strategy to follow: ${strategy}` : ''}
      Include: 
      1. Optimized Title (max 70 chars, MUST append the brand name " | ${brandName}" at the end if brand name is provided)
      2. Optimized Summary (max 500 chars)
      3. Recommended Keywords (array)
      4. Alt text suggestions for media (array)
      Product: ${JSON.stringify(product)}`;
      
      const prompt = customPrompt 
        ? `${customPrompt}\n\nContext:\nProduct: ${JSON.stringify(product)}\nBrand: ${brandName}\nSelected Keywords: ${selectedKeywords.join(', ')}\nStrategy: ${strategy}`
        : defaultPrompt;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              optimizedTitle: { type: Type.STRING },
              optimizedSummary: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              altTextSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["optimizedTitle", "optimizedSummary", "keywords", "altTextSuggestions"]
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return {
        optimizedTitle: `${product.title} - 高品质专业选择`,
        optimizedSummary: `这款${product.title}经过精心设计，旨在提供卓越的性能与舒适度。立即购买，体验不一样的品质。`,
        keywords: ["高品质", "专业设计", "限时优惠"],
        altTextSuggestions: ["产品正面展示图", "细节特写", "使用场景图"]
      };
    }
  }

  async generateSEODescription(title: string, content: string, brandName: string = '') {
    try {
      const prompt = `Generate a compelling SEO meta description (max 200 chars) in Chinese for the following content. 
      ${brandName ? `Brand Name: ${brandName}` : ''}
      Title: ${title}
      Content: ${content.substring(0, 500)}`;
      
      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING }
            },
            required: ["description"]
          }
        }
      }));

      return JSON.parse(response.text).description;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return `了解更多关于${title}的信息。我们提供高品质的产品与专业服务，欢迎咨询。`;
    }
  }

  private getLanguageName(lang: string): string {
    const map: { [key: string]: string } = {
      '英语': 'English',
      '中文': 'Chinese',
      '德语': 'German',
      '法语': 'French',
      '日语': 'Japanese',
      '西班牙语': 'Spanish'
    };
    return map[lang] || lang;
  }

  async generateSEOContent(
    type: 'product' | 'collection' | 'blog' | 'page', 
    data: any, 
    keywordCount: number = 5, 
    language: string = '英语', 
    brandName: string = '', 
    strategy: string = '',
    selectedKeywords: string[] = [],
    excludedKeywords: string = '',
    primaryKeyword: string = '',
    customPrompt?: string
  ) {
    try {
      const langName = this.getLanguageName(language);
      const defaultPrompt = `Analyze this ${type} and provide SEO optimized content in ${langName}. 
      ${brandName ? `Brand Name: ${brandName}` : ''}
      ${primaryKeyword ? `CRITICAL PRIMARY KEYWORD: "${primaryKeyword}". This keyword MUST be included in the SEO Title and SEO Description.` : ''}
      ${selectedKeywords.length > 0 ? `PRIMARY Core Keywords (PRIORITIZE THESE): ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `Secondary Overall SEO Strategy: ${strategy}` : ''}
      ${excludedKeywords ? `EXCLUDED Keywords (DO NOT use these words in any generated content): ${excludedKeywords}` : ''}
      Include: 
      1. SEO Title (max 70 chars, MUST append the brand name " | ${brandName}" at the end if brand name is provided)
      2. SEO Description (max 160 chars)
      3. URL Slug (alphanumeric and hyphens only)
      4. Keywords (array of exactly ${keywordCount} relevant keywords in ${langName}. IMPORTANT: All keywords MUST be in ${langName}. ${langName !== 'Chinese' ? `If input keywords are in Chinese, translate them to ${langName}. Strictly forbidden to output Chinese keywords.` : ''})
      5. Selling Points (array of 3-5 key selling points in ${langName})
      Data: ${JSON.stringify(data)}`;

      const prompt = customPrompt 
        ? `${customPrompt}\n\nContext Data:\nType: ${type}\nLanguage: ${langName}\nBrand: ${brandName}\nPrimary Keyword: ${primaryKeyword}\nSelected Keywords: ${selectedKeywords.join(', ')}\nStrategy: ${strategy}\nExcluded: ${excludedKeywords}\nData: ${JSON.stringify(data)}`
        : defaultPrompt;
      
      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              seoTitle: { type: Type.STRING },
              seoDescription: { type: Type.STRING },
              seoUrl: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              sellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["seoTitle", "seoDescription", "seoUrl", "keywords", "sellingPoints"]
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      const title = data.title || data.name || 'new-content';
      return {
        seoTitle: `${title} - Professional High Quality Choice`,
        seoDescription: `Discover our ${title}. We provide excellent quality and professional service to meet your various needs. Learn more details now.`,
        seoUrl: title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        keywords: Array(keywordCount).fill("High Quality"),
        sellingPoints: ["Excellent Quality Assurance", "Professional Technical Support", "Competitive Prices"]
      };
    }
  }

  async generateKeywords(
    type: string, 
    data: any, 
    keywordCount: number = 5, 
    language: string = '英语', 
    brandName: string = '', 
    strategy: string = '',
    selectedKeywords: string[] = [],
    excludedKeywords: string = '',
    customPrompt?: string
  ) {
    try {
      const langName = this.getLanguageName(language);
      const defaultPrompt = `Generate exactly ${keywordCount} highly relevant SEO keywords in ${langName} for this ${type}. 
      IMPORTANT: All generated keywords MUST be in ${langName}. ${langName !== 'Chinese' ? `If the input keywords or data are in Chinese, you MUST translate and generate the keywords in ${langName}. Strictly forbidden to output Chinese keywords.` : ''}
      ${brandName ? `Brand Name: ${brandName}` : ''}
      ${selectedKeywords.length > 0 ? `PRIMARY Core Keywords (PRIORITIZE THESE): ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `Secondary Overall SEO Strategy: ${strategy}` : ''}
      ${excludedKeywords ? `EXCLUDED Keywords (DO NOT use these words in any generated content): ${excludedKeywords}` : ''}
      Data: ${JSON.stringify(data)}`;
      
      const prompt = customPrompt 
        ? `${customPrompt}\n\nContext Data:\nType: ${type}\nLanguage: ${langName}\nBrand: ${brandName}\nSelected Keywords: ${selectedKeywords.join(', ')}\nStrategy: ${strategy}\nExcluded: ${excludedKeywords}\nData: ${JSON.stringify(data)}`
        : defaultPrompt;
      
      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["keywords"]
          }
        }
      }));

      return JSON.parse(response.text).keywords;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return Array(keywordCount).fill("High Quality");
    }
  }

  async generateSiteConfig(brandInfo: string) {
    try {
      const prompt = `Based on this brand description: "${brandInfo}", generate a professional B2B website configuration in Chinese. Include brand name, hero title, subtitle, primary color (hex), and 4 key sections.`;
      
      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brandName: { type: Type.STRING },
              heroTitle: { type: Type.STRING },
              heroSubtitle: { type: Type.STRING },
              primaryColor: { type: Type.STRING },
              sections: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["brandName", "heroTitle", "heroSubtitle", "primaryColor", "sections"]
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return {
        brandName: "SmartTrade Pro",
        heroTitle: "全球领先的工业解决方案提供商",
        heroSubtitle: "为您提供高品质、可靠的工业产品与专业服务",
        primaryColor: "#2563eb",
        sections: ["关于我们", "产品中心", "技术支持", "联系我们"]
      };
    }
  }

  async processChatCommand(message: string) {
    try {
      const prompt = `You are a B2B SaaS Store Assistant. The user says: "${message}". 
      Determine if they want to: 
      1. Create a product (return type: "CREATE_PRODUCT", data: {name, price, category, description})
      2. Create a blog post (return type: "CREATE_BLOG", data: {title, content, tags})
      3. Create a customer (return type: "CREATE_CUSTOMER", data: {name, company, email})
      4. Decorate/Design store (return type: "DECORATE_STORE", data: {suggestion, themeColor})
      5. Optimize SEO (return type: "OPTIMIZE_SEO", data: {keywords, metaDescription, suggestions}). 
         IMPORTANT: DO NOT include any suggestions related to Structured Data Markup (JSON-LD, Schema.org, etc.).
      6. Analyze data (return type: "ANALYZE_DATA", data: {insight})
      7. General help (return type: "HELP", data: {response})
      Respond in Chinese.`;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              data: { type: Type.OBJECT, properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER },
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                company: { type: Type.STRING },
                email: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                themeColor: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                metaDescription: { type: Type.STRING },
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                insight: { type: Type.STRING },
                response: { type: Type.STRING }
              }}
            },
            required: ["type", "data"]
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return { type: "HELP", data: { response: "抱歉，我暂时无法处理您的请求。您可以尝试说'帮我创建一个水泵产品'。" } };
    }
  }

  async modifySectionStyle(section: any, prompt: string) {
    try {
      const systemPrompt = `You are a professional UI/UX designer. The user wants to modify a website section.
      Current section data: ${JSON.stringify(section)}
      User request: "${prompt}"
      
      Modify the section's content and properties based on the request.
      Return the updated section object. Keep the same structure.
      Respond in Chinese for any text content.
      If the user asks for style changes (colors, fonts, layout), update the content properties accordingly.`;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              name: { type: Type.STRING },
              content: { 
                type: Type.OBJECT, 
                properties: {
                  title: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  buttonText: { type: Type.STRING },
                  imageUrl: { type: Type.STRING },
                  backgroundColor: { type: Type.STRING },
                  textColor: { type: Type.STRING },
                  padding: { type: Type.STRING },
                  items: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.STRING },
                        image: { type: Type.STRING }
                      }
                    } 
                  }
                }
              }
            },
            required: ["id", "type", "name"]
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return section;
    }
  }

  async generateSection(prompt: string) {
    try {
      const systemPrompt = `You are a professional UI/UX designer. Generate a website section based on this prompt: "${prompt}"
      
      Choose an appropriate section type (header, banner, products, reviews, footer, text, features).
      Return a section object with appropriate content and styles.
      Respond in Chinese for any text content.`;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: "The type of section (banner, products, reviews, etc.)" },
              name: { type: Type.STRING, description: "A descriptive name for the section" },
              content: { 
                type: Type.OBJECT, 
                properties: {
                  title: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  buttonText: { type: Type.STRING },
                  imageUrl: { type: Type.STRING },
                  backgroundColor: { type: Type.STRING },
                  textColor: { type: Type.STRING },
                  items: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.STRING },
                        image: { type: Type.STRING }
                      }
                    } 
                  }
                }
              }
            },
            required: ["type", "name", "content"]
          }
        }
      }));

      const data = JSON.parse(response.text);
      return {
        id: Date.now().toString(),
        ...data
      };
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return {
        id: Date.now().toString(),
        type: 'banner',
        name: 'AI 生成版块',
        content: {
          title: 'AI 无法生成，请重试',
          subtitle: '抱歉，生成过程中出现了错误。',
          backgroundColor: '#f8fafc',
          textColor: '#0f172a'
        }
      };
    }
  }

  async modifyGlobalStyles(currentStyles: any, prompt: string) {
    try {
      const systemPrompt = `You are a professional UI/UX designer. The user wants to modify the global styles of their website.
      Current styles: ${JSON.stringify(currentStyles)}
      User request: "${prompt}"
      
      Modify the styles based on the request. Focus on colors, fonts, and general theme.
      Return the updated styles object.`;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primaryColor: { type: Type.STRING },
              secondaryColor: { type: Type.STRING },
              backgroundColor: { type: Type.STRING },
              textColor: { type: Type.STRING },
              fontFamily: { type: Type.STRING },
              borderRadius: { type: Type.STRING },
              spacing: { type: Type.STRING }
            }
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return currentStyles;
    }
  }

  async modifyElement(section: any, elementPath: string, prompt: string) {
    try {
      const systemPrompt = `You are a professional UI/UX designer. The user wants to modify a specific element within a website section.
      Current section data: ${JSON.stringify(section)}
      Element to modify (path in content): "${elementPath}"
      User request: "${prompt}"
      
      Modify the specific element's content and properties based on the request.
      Return the updated section object. Keep the same structure.
      Respond in Chinese for any text content.`;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              name: { type: Type.STRING },
              content: { type: Type.OBJECT }
            },
            required: ["id", "type", "name", "content"]
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return section;
    }
  }

  async analyzeSiteSEO(storeInfo: string, items: { products: any[], collections: any[], blogs: any[], pages: any[] }, targetMarket: string = '美国', targetLanguage: string = '英语', brandName: string = '', excludedKeywords: string = '', customPrompt?: string) {
    try {
      const langName = this.getLanguageName(targetLanguage);
      const defaultPrompt = `请根据以下信息对该商店进行 SEO 分析，并提供全面的策略和关键词列表。
      商店信息: "${storeInfo}"
      品牌词: "${brandName}"
      排除词: "${excludedKeywords}"
      目标市场: "${targetMarket}"
      目标语言: "${targetLanguage}" (${langName})
      
      上下文数据 (考虑的项):
      - 产品: ${JSON.stringify(items.products)}
      - 集合: ${JSON.stringify(items.collections)}
      - 博客: ${JSON.stringify(items.blogs)}
      - 页面: ${JSON.stringify(items.pages)}
      
      请提供:
      1. 整体 SEO 策略 (中文，要求详细且专业。包含：1. 站内技术优化建议；2. 内容营销与博客策略；3. 外部链接建设思路；4. 针对 ${targetMarket} 市场的本地化建议。字数要求在 300-500 字之间，语气专业且具有启发性。同时请注意在生成的所有内容中排除以下词汇：${excludedKeywords})
      2. 推荐关键词 (数组，必须且只能使用 ${targetLanguage} (${langName}) 语言。即便核心关键词是中文，生成的推荐关键词也必须翻译并使用 ${targetLanguage}。这是最重要的一点。严禁输出中文关键词。同时排除以下词汇：${excludedKeywords})
      
      请以 JSON 格式返回。`;

      const prompt = customPrompt
        ? `${customPrompt}\n\nIMPORTANT: The 'Overall SEO Strategy' (strategy field) MUST be written in Chinese (整体 SEO 策略的文案必须为中文), regardless of the target language.\n\nContext Data:\nStore Info: ${storeInfo}\nBrand: ${brandName}\nExcluded: ${excludedKeywords}\nTarget Market: ${targetMarket}\nTarget Language: ${targetLanguage}\nItems: ${JSON.stringify(items)}`
        : defaultPrompt;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategy: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["strategy", "keywords"]
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      const langName = this.getLanguageName(targetLanguage);
      const isEnglish = langName === 'English';
      return {
        strategy: "重点优化核心产品的关键词覆盖，提升页面加载速度。",
        keywords: isEnglish ? ["High Quality", "Professional Service", "Industry Leading"] : ["高品质", "专业服务", "行业领先"]
      };
    }
  }

  async recommendCompetitors(storeInfo: string, products: any[], targetMarket: string = '美国') {
    try {
      const prompt = `Based on this store info and products, recommend 3-5 top competitors in the ${targetMarket} market.
      Store Info: "${storeInfo}"
      Products: ${JSON.stringify(products.slice(0, 5))}
      
      For each competitor, provide:
      1. Name
      2. Estimated SEO Score (0-100)
      3. Estimated Monthly Organic Traffic
      4. Estimated Number of Ranking Keywords
      
      Respond in JSON format.`;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                score: { type: Type.NUMBER },
                traffic: { type: Type.NUMBER },
                keywords: { type: Type.NUMBER }
              },
              required: ["name", "score", "traffic", "keywords"]
            }
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return [
        { name: '竞品 C', score: 82, traffic: 11000, keywords: 410 },
        { name: '竞品 D', score: 75, traffic: 9800, keywords: 350 }
      ];
    }
  }

  async generateAltText(
    pageTitle: string, 
    imageContext: string = '', 
    language: string = '英语', 
    brandName: string = '', 
    strategy: string = '',
    selectedKeywords: string[] = [],
    excludedKeywords: string = '',
    customPrompt?: string
  ) {
    try {
      const langName = this.getLanguageName(language);
      const defaultPrompt = `Generate a descriptive and SEO-friendly image Alt text in ${langName} for an image on a page titled "${pageTitle}".
      IMPORTANT: The Alt text MUST be in ${langName}.
      ${brandName ? `Brand Name: ${brandName}` : ''}
      ${selectedKeywords.length > 0 ? `PRIMARY Core Keywords (PRIORITIZE THESE): ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `Secondary Overall SEO Strategy: ${strategy}` : ''}
      ${excludedKeywords ? `EXCLUDED Keywords (DO NOT use these words in any generated content): ${excludedKeywords}` : ''}
      Context: ${imageContext}
      Return only the Alt text string.`;

      const prompt = customPrompt 
        ? `${customPrompt}\n\nContext Data:\nPage Title: ${pageTitle}\nImage Context: ${imageContext}\nLanguage: ${langName}\nBrand: ${brandName}\nKeywords: ${selectedKeywords.join(', ')}\nStrategy: ${strategy}\nExcluded: ${excludedKeywords}`
        : defaultPrompt;
      
      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              altText: { type: Type.STRING }
            },
            required: ["altText"]
          }
        }
      }));

      return JSON.parse(response.text).altText;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return `${pageTitle} image`;
    }
  }

  async optimizeAltTexts(
    images: any[],
    language: string = '英语',
    brandName: string = '',
    strategy: string = '',
    selectedKeywords: string[] = [],
    excludedKeywords: string = ''
  ) {
    try {
      const langName = this.getLanguageName(language);
      const prompt = `Generate descriptive and SEO-friendly image Alt texts in ${langName} for the following images.
      IMPORTANT: All optimized Alt texts MUST be in ${langName}.
      ${brandName ? `Brand Name: ${brandName}` : ''}
      ${selectedKeywords.length > 0 ? `PRIMARY Core Keywords (PRIORITIZE THESE): ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `Secondary Overall SEO Strategy: ${strategy}` : ''}
      ${excludedKeywords ? `EXCLUDED Keywords (DO NOT use these words in any generated content): ${excludedKeywords}` : ''}
      
      Images:
      ${JSON.stringify(images.map(img => ({ id: img.id, name: img.name, pageTitle: img.parentTitle })))}
      
      Provide an array of objects:
      - id: The image's ID
      - altText: The optimized Alt text
      
      Respond in Chinese.`;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                altText: { type: Type.STRING }
              },
              required: ["id", "altText"]
            }
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return [];
    }
  }

  async optimizeSpecificSEOFields(
    items: any[], 
    type: 'title' | 'description' | 'handle' | 'all',
    storeInfo: string,
    targetMarket: string = '美国',
    targetLanguage: string = '英语',
    brandName: string = '',
    strategy: string = '',
    selectedKeywords: string[] = []
  ) {
    try {
      const prompt = `Optimize the following SEO fields for these items.
      Type of Optimization: ${type === 'all' ? 'Full SEO (Title, Description, Handle)' : `Only ${type.toUpperCase()}`}
      Store Info: "${storeInfo}"
      ${brandName ? `Brand Name: ${brandName}` : ''}
      ${selectedKeywords.length > 0 ? `PRIMARY Core Keywords (PRIORITIZE THESE): ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `Secondary Overall SEO Strategy: ${strategy}` : ''}
      Target Market: "${targetMarket}"
      Target Language: "${targetLanguage}"
      
      Items to Optimize:
      ${JSON.stringify(items.map(i => ({ id: i.id, title: i.title || i.name, currentTitle: i.seoTitle, currentDescription: i.seoDescription, currentHandle: i.handle, keywords: i.keywords })))}
      
      Provide:
      An array of objects, one for each item, containing the optimized fields.
      - id: The item's ID
      - seoTitle: (Only if type is 'title' or 'all'. MUST append the brand name " | ${brandName}" at the end if brand name is provided)
      - seoDescription: (Only if type is 'description' or 'all')
      - handle: (Only if type is 'handle' or 'all')
      
      Respond in Chinese.`;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                seoTitle: { type: Type.STRING },
                seoDescription: { type: Type.STRING },
                handle: { type: Type.STRING }
              },
              required: ["id"]
            }
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return [];
    }
  }

  async generateBlogTopics(
    products: any[], 
    brandName: string = '', 
    count: number = 5, 
    language: string = 'Chinese',
    strategy: string = '',
    selectedKeywords: string[] = [],
    customPrompt?: string
  ) {
    try {
      const langName = this.getLanguageName(language);
      const defaultPrompt = `Based on these products and brand "${brandName}", generate ${count} creative and SEO-friendly blog post topics in ${langName}. 
      
      Optimization Goals (QuickCreator Style):
      1. Focus on "High-Value, Low-Competition" long-tail keywords.
      2. Vary the Search Intent: Informational (How-to), Commercial Investigation (Comparison), and Navigational.
      3. Ensure topics are highly relevant to the brand and products to drive conversions.
      4. Target specific audience pain points.
      ${selectedKeywords.length > 0 ? `5. PRIORITIZE using these Core Keywords: ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `6. Align with this Overall SEO Strategy: ${strategy}` : ''}

      IMPORTANT: All generated content, including titles and keywords, MUST be in ${langName}.
      
      For each topic, provide:
      1. Title: Catchy, high-CTR title.
      2. Keywords: 5-8 highly relevant SEO keywords.
      3. Type: The content format (e.g., "Listicle", "How-to Guide", "Comparison", "Case Study").
      4. Description: A brief summary of what the blog will cover (2-3 sentences).
      5. Target Products: Array of product IDs from the provided list that are most relevant.
      6. Outline: A structured outline for the blog post. MUST use clear hierarchical numbering (e.g., 1., 1.1., 1.1.1.) and proper indentation.
      
      Products: ${JSON.stringify(products.map(p => ({ id: p.id, title: p.title, category: p.category })))}`;
      
      const prompt = customPrompt 
        ? `${customPrompt}\n\nIMPORTANT: The 'Outline' MUST use clear hierarchical numbering (e.g., 1., 1.1., 1.1.1.) and proper indentation.\n\nContext:\nBrand: "${brandName}"\nLanguage: ${langName}\nSelected Keywords: ${selectedKeywords.join(', ')}\nStrategy: ${strategy}\nProducts: ${JSON.stringify(products.map(p => ({ id: p.id, title: p.title, category: p.category })))}`
        : defaultPrompt;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                targetProductIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                outline: { type: Type.STRING }
              },
              required: ["title", "keywords", "type", "description", "targetProductIds", "outline"]
            }
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return [];
    }
  }

  async generateManualBlogTopics(
    keywords: string, 
    products: any[], 
    pages: any[], 
    brandName: string = '', 
    count: number = 5, 
    language: string = 'Chinese',
    strategy: string = '',
    selectedKeywords: string[] = [],
    customPrompt?: string
  ) {
    try {
      const defaultPrompt = `Based on these keywords: "${keywords}", products, and pages, generate ${count} creative and SEO-friendly blog post topics in ${language}. 
      ${brandName ? `Brand Name: ${brandName}` : ''}
      ${selectedKeywords.length > 0 ? `Core Keywords to prioritize: ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `SEO Strategy to follow: ${strategy}` : ''}
      
      Optimization Goals (QuickCreator Style):
      1. Directly address the provided keywords while maintaining high topical relevance.
      2. Create "SEO-ready" topics that can easily rank for the target keywords.
      3. Use a mix of content types: Guides, Tips, Trends, or Comparisons.
      4. Ensure the topics naturally lead to the featured products or pages.

      For each topic, provide:
      1. Title: Catchy, high-CTR title.
      2. Keywords: 5-8 highly relevant SEO keywords (including the provided ones).
      3. Type: The content format (e.g., "Listicle", "How-to Guide", "Comparison", "Case Study").
      4. Description: A brief summary of what the blog will cover.
      5. Target Products: Array of product IDs from the provided list.
      6. Target Pages: Array of page IDs from the provided list.
      7. Outline: A structured outline for the blog post. MUST use clear hierarchical numbering (e.g., 1., 1.1., 1.1.1.) and proper indentation.

      Products: ${JSON.stringify(products.map(p => ({ id: p.id, title: p.title, category: p.category })))}
      Pages: ${JSON.stringify(pages.map(p => ({ id: p.id, title: p.title })))}`;
      
      const prompt = customPrompt 
        ? `${customPrompt}\n\nIMPORTANT: The 'Outline' MUST use clear hierarchical numbering (e.g., 1., 1.1., 1.1.1.) and proper indentation.\n\nContext:\nKeywords: "${keywords}"\nBrand: "${brandName}"\nLanguage: ${language}\nSelected Keywords: ${selectedKeywords.join(', ')}\nStrategy: ${strategy}\nProducts: ${JSON.stringify(products.map(p => ({ id: p.id, title: p.title, category: p.category })))}`
        : defaultPrompt;

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                targetProductIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                targetPageIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                outline: { type: Type.STRING }
              },
              required: ["title", "keywords", "type", "description", "targetProductIds", "targetPageIds", "outline"]
            }
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return [];
    }
  }

  async generateImage(prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9", referenceImage?: string) {
    try {
      const parts: any[] = [{ text: prompt }];
      
      if (referenceImage) {
        // Extract base64 data and mimeType from data URL if provided
        const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }

      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: parts,
        },
        config: {
          imageConfig: {
            aspectRatio,
          },
        },
      }));

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
      return null;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Image Generation Error:", error);
      }
      return null;
    }
  }

  async generateBlogContent(
    topic: string, 
    products: any[], 
    brandName: string = '', 
    language: string = 'Chinese', 
    strategy: string = '',
    selectedKeywords: string[] = [],
    customPrompt?: string,
    outline?: string
  ) {
    try {
      const defaultPrompt = `Write a professional, high-quality, and SEO-optimized blog post in ${language} for the topic: "${topic}".
      Brand: "${brandName}"
      Relevant Products to feature: ${JSON.stringify(products.map(p => ({ id: p.id, title: p.title, description: p.description, url: `/products/${p.id}` })))}
      ${selectedKeywords.length > 0 ? `Core Keywords to Include: ${selectedKeywords.join(', ')}` : ''}
      ${strategy ? `SEO Strategy to Follow: ${strategy}` : ''}
      ${outline ? `Outline to Follow: ${outline}` : ''}
      
      Requirements (Follow QuickCreator & Google SEO Best Practices):
      1. Engaging, high-CTR Title (H1).
      2. Content Structure:
         - Table of Contents (TOC) at the beginning.
         - Strong Introduction (Inverted Pyramid style).
         - Key Takeaways section.
         - Comprehensive body content (at least 800-1000 words) demonstrating E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).
         - Use clear semantic structure (H2, H3, H4).
         - FAQ section at the end with 3-5 common questions and concise answers.
         - Concluding summary with a clear Call-to-Action (CTA).
      3. SEO Optimization:
         - Naturally integrate primary and LSI keywords.
         - Internal Linking: Link to featured products using descriptive anchor text (e.g., "check out our [Product Name]" instead of "click here").
         - Optimize for Featured Snippets by providing direct answers to "What is", "How to", or "Why" questions in the text.
         - Suggest a descriptive image Alt text for the header image.
         - Include a valid JSON-LD (Schema.org) script for Article or BlogPosting.
      4. Metadata:
         - SEO Meta Title (max 70 chars, append " | ${brandName}" if provided).
         - SEO Meta Description (max 155 chars, include a CTA).
      5. Formatting:
         - Clean Markdown.
         - Use bullet points, numbered lists, bold text, and tables to improve readability.
         - Short paragraphs and active voice.
      
      Return the result as a structured JSON object.`;

      const prompt = customPrompt 
        ? `${customPrompt}\n\nIMPORTANT: You MUST return a structured JSON object following the required schema. Ensure the content is in ${language}.\n\nContext:\nTopic: "${topic}"\nBrand: "${brandName}"\nSelected Keywords: ${selectedKeywords.join(', ')}\nStrategy: ${strategy}\nOutline: ${outline || 'None'}\nRelevant Products: ${JSON.stringify(products.map(p => ({ id: p.id, title: p.title, description: p.description, url: `/products/${p.id}` })))}`
        : defaultPrompt;
      
      const response = await this.callWithRetry(() => this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING, description: "Markdown formatted blog content" },
              imageDescription: { type: Type.STRING },
              seoTitle: { type: Type.STRING },
              seoDescription: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              jsonLd: { type: Type.STRING, description: "Valid JSON-LD script for the article" },
              score: { type: Type.NUMBER, description: "SEO Score (0-100)" },
              scoreReason: { type: Type.STRING, description: "Reason for the score in Chinese" }
            },
            required: ["title", "content", "imageDescription", "seoTitle", "seoDescription", "keywords", "jsonLd", "score", "scoreReason"]
          }
        }
      }));

      return JSON.parse(response.text);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Gemini Error:", error);
      }
      return null;
    }
  }
}

export const geminiService = new GeminiService();
