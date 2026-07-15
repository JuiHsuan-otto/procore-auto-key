from typing import Dict, Any, Optional
import aiohttp
import asyncio
import json
import logging
from datetime import datetime

class ClaudeIntegration:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.anthropic.com/v1"
        self.setup_logging()
        
    def setup_logging(self):
        self.logger = logging.getLogger('claude_integration')
        self.logger.setLevel(logging.INFO)
        handler = logging.FileHandler('claude_integration.log', encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(handler)

    async def generate_completion(
        self, 
        prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: str = "claude-3-sonnet-20240221"
    ) -> Optional[str]:
        """生成回應"""
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01"
        }
        
        data = {
            "prompt": prompt,
            "max_tokens_to_sample": max_tokens,
            "temperature": temperature,
            "model": model
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/complete",
                    headers=headers,
                    json=data
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        self.logger.info(f"Successfully generated completion")
                        return result.get("completion")
                    else:
                        error_text = await response.text()
                        self.logger.error(f"API error: {error_text}")
                        return None
        except Exception as e:
            self.logger.error(f"Request failed: {str(e)}")
            return None
            
    async def analyze_code(self, code: str) -> Optional[Dict[str, Any]]:
        """分析程式碼"""
        prompt = f"""Please analyze this code and provide feedback:

{code}

Please provide:
1. Code quality assessment
2. Potential improvements
3. Security concerns
4. Performance optimization suggestions
"""
        
        response = await self.generate_completion(prompt)
        if not response:
            return None
            
        try:
            # 將回應結構化
            analysis = {
                "quality": "Pending analysis",
                "improvements": [],
                "security": [],
                "performance": [],
                "timestamp": datetime.now().isoformat()
            }
            
            # 解析回應文本
            lines = response.split('\n')
            current_section = None
            
            for line in lines:
                if "Code quality" in line:
                    current_section = "quality"
                elif "improvements" in line.lower():
                    current_section = "improvements"
                elif "security" in line.lower():
                    current_section = "security"
                elif "performance" in line.lower():
                    current_section = "performance"
                elif line.strip() and current_section:
                    if current_section == "quality":
                        analysis["quality"] = line.strip()
                    else:
                        analysis[current_section].append(line.strip())
                        
            return analysis
        except Exception as e:
            self.logger.error(f"Failed to parse analysis: {str(e)}")
            return None
            
    async def enhance_seo_content(self, content: Dict[str, str]) -> Optional[Dict[str, str]]:
        """增強 SEO 內容"""
        prompt = f"""Please optimize this content for SEO:

Title: {content.get('title', '')}
Description: {content.get('description', '')}
Keywords: {content.get('keywords', '')}
Content: {content.get('content', '')}

Please provide:
1. Optimized title
2. Meta description
3. Enhanced content with proper H1-H6 structure
4. Schema.org JSON-LD markup
"""
        
        response = await self.generate_completion(prompt)
        if not response:
            return None
            
        try:
            # 解析回應
            enhanced = {
                "title": "",
                "description": "",
                "content": "",
                "jsonld": "",
                "timestamp": datetime.now().isoformat()
            }
            
            sections = response.split('\n\n')
            for section in sections:
                if section.startswith('Title:'):
                    enhanced['title'] = section.replace('Title:', '').strip()
                elif section.startswith('Meta description:'):
                    enhanced['description'] = section.replace('Meta description:', '').strip()
                elif section.startswith('Content:'):
                    enhanced['content'] = section.replace('Content:', '').strip()
                elif section.startswith('{'):
                    enhanced['jsonld'] = section.strip()
                    
            return enhanced
        except Exception as e:
            self.logger.error(f"Failed to parse SEO enhancement: {str(e)}")
            return None
            
    async def generate_technical_content(self, topic: str, keywords: List[str]) -> Optional[Dict[str, Any]]:
        """生成技術文章"""
        prompt = f"""Please write a technical article about:

Topic: {topic}
Keywords: {', '.join(keywords)}

Requirements:
1. Professional tone
2. Technical accuracy
3. SEO optimization
4. Proper HTML structure
5. Schema.org markup
"""
        
        response = await self.generate_completion(
            prompt,
            max_tokens=4000,
            temperature=0.8
        )
        
        if not response:
            return None
            
        try:
            # 解析生成的內容
            article = {
                "html": "",
                "metadata": {
                    "title": "",
                    "description": "",
                    "keywords": keywords,
                    "created_at": datetime.now().isoformat()
                },
                "jsonld": ""
            }
            
            # 提取 HTML 內容和元數據
            parts = response.split('---')
            for part in parts:
                if part.strip().startswith('{'):
                    article['jsonld'] = part.strip()
                elif part.strip().startswith('<'):
                    article['html'] = part.strip()
                elif 'Title:' in part:
                    lines = part.strip().split('\n')
                    for line in lines:
                        if line.startswith('Title:'):
                            article['metadata']['title'] = line.replace('Title:', '').strip()
                        elif line.startswith('Description:'):
                            article['metadata']['description'] = line.replace('Description:', '').strip()
                            
            return article
        except Exception as e:
            self.logger.error(f"Failed to generate article: {str(e)}")
            return None

    def save_to_file(self, content: Dict[str, Any], file_path: str) -> bool:
        """保存內容到文件"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                if file_path.endswith('.json'):
                    json.dump(content, f, ensure_ascii=False, indent=2)
                else:
                    f.write(content.get('html', content.get('content', str(content))))
            self.logger.info(f"Successfully saved content to {file_path}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to save file {file_path}: {str(e)}")
            return False