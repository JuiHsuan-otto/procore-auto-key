from claude_enhanced import ClaudeIntegration
import asyncio
import json
from typing import Dict, Any

class ContentEnhancer:
    def __init__(self, api_key: str):
        self.claude = ClaudeIntegration(api_key)
        
    async def enhance_article(self, article_path: str) -> bool:
        """增強現有文章"""
        try:
            # 讀取文章
            with open(article_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # 提取現有元數據
            metadata = self._extract_metadata(content)
            
            # 使用 Claude 增強內容
            enhanced = await self.claude.enhance_seo_content({
                "title": metadata.get("title", ""),
                "description": metadata.get("description", ""),
                "keywords": metadata.get("keywords", ""),
                "content": content
            })
            
            if not enhanced:
                return False
                
            # 創建備份
            backup_path = article_path.replace('.html', '.bak.html')
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            # 保存增強後的內容
            return self.claude.save_to_file(enhanced, article_path)
        except Exception as e:
            print(f"增強文章失敗: {str(e)}")
            return False
            
    def _extract_metadata(self, html_content: str) -> Dict[str, str]:
        """從 HTML 提取元數據"""
        metadata = {
            "title": "",
            "description": "",
            "keywords": ""
        }
        
        try:
            # 提取 title
            if "<title>" in html_content:
                start = html_content.index("<title>") + 7
                end = html_content.index("</title>")
                metadata["title"] = html_content[start:end].strip()
                
            # 提取 meta description
            if 'name="description"' in html_content:
                start = html_content.index('name="description"')
                content_start = html_content.index('content="', start) + 9
                content_end = html_content.index('"', content_start)
                metadata["description"] = html_content[content_start:content_end].strip()
                
            # 提取 keywords
            if 'name="keywords"' in html_content:
                start = html_content.index('name="keywords"')
                content_start = html_content.index('content="', start) + 9
                content_end = html_content.index('"', content_start)
                metadata["keywords"] = html_content[content_start:content_end].strip()
        except Exception:
            pass
            
        return metadata
        
    async def generate_new_article(self, topic: str, keywords: list) -> str:
        """生成新文章"""
        article = await self.claude.generate_technical_content(topic, keywords)
        if not article:
            return None
            
        # 生成文件名
        filename = self._generate_filename(article['metadata']['title'])
        
        # 保存文章
        if self.claude.save_to_file(article, filename):
            return filename
        return None
        
    def _generate_filename(self, title: str) -> str:
        """根據標題生成文件名"""
        # 移除特殊字符
        filename = "".join(c for c in title if c.isalnum() or c.isspace())
        # 轉換為小寫並替換空格為連字符
        filename = filename.lower().replace(" ", "-")
        return f"article-{filename}.html"

# 使用示例
async def main():
    # 使用您的 Claude API 密鑰初始化
    enhancer = ContentEnhancer("your-api-key-here")
    
    # 增強現有文章
    await enhancer.enhance_article("article-example.html")
    
    # 生成新文章
    new_article = await enhancer.generate_new_article(
        "BMW G-Series 智慧鑰匙技術解析",
        ["BMW", "G-Series", "智慧鑰匙", "晶片防盜", "汽車科技"]
    )
    
    if new_article:
        print(f"新文章已生成: {new_article}")

if __name__ == "__main__":
    asyncio.run(main())