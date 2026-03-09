from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io
import os
import sqlite3
import json
import google.generativeai as genai
from pydantic import BaseModel
from typing import Optional, Any
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

app = FastAPI(title="AI Auto Data Analyzer API")

# Global in-memory storage for the session
current_df: Optional[pd.DataFrame] = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Utility to clean data for JSON serialization (handles NaN, Inf)
def clean_for_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(v) for v in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
    return obj

class AnalysisRequest(BaseModel):
    summary: dict

class ChatRequest(BaseModel):
    question: str

@app.get("/")
async def root():
    return {"message": "AI Auto Data Analyzer API is running"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global current_df
    if not file.filename.endswith(('.xlsx', '.csv')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload Excel or CSV.")
    
    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            current_df = pd.read_csv(io.BytesIO(content))
        else:
            current_df = pd.read_excel(io.BytesIO(content))
        
        # Data Cleaning
        current_df = current_df.replace([np.inf, -np.inf], np.nan)
        current_df = current_df.drop_duplicates()
        
        # Generate Chart Data
        chart_data = []
        # Identify numeric columns
        num_cols = current_df.select_dtypes(include=['number']).columns[:3]
        for col in num_cols:
            # Drop NaN for specific chart calculation
            clean_col = current_df[col].dropna()
            if not clean_col.empty:
                counts, bins = pd.cut(clean_col, bins=10, retbins=True)
                chart_data.append({
                    "type": "bar",
                    "title": f"Distribution of {col}",
                    "labels": [f"{bins[i]:.1f}-{bins[i+1]:.1f}" for i in range(len(bins)-1)],
                    "values": clean_col.value_counts(bins=10, sort=False).tolist()
                })
            
        # Identify categorical columns
        cat_cols = current_df.select_dtypes(include=['object', 'category']).columns[:1]
        for col in cat_cols:
            top_vals = current_df[col].value_counts().head(5)
            chart_data.append({
                "type": "pie",
                "title": f"Top Categories in {col}",
                "labels": top_vals.index.tolist(),
                "values": top_vals.values.tolist()
            })

        metadata = {
            "filename": file.filename,
            "rows": len(current_df),
            "columns": list(current_df.columns),
            "types": {col: str(dtype) for col, dtype in current_df.dtypes.items()}
        }
        
        # Prepare summary and handle JSON-incompatible NaN/Inf values
        summary_df = current_df.describe(include='all')
        summary_dict = summary_df.to_dict()
        
        return clean_for_json({
            "status": "success",
            "metadata": metadata,
            "summary": summary_dict,
            "charts": chart_data
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/download")
async def download_cleaned_data():
    global current_df
    if current_df is None:
        raise HTTPException(status_code=400, detail="No data available to download.")
    
    try:
        # Create Excel in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            current_df.to_excel(writer, index=False, sheet_name='CleanData')
        output.seek(0)
        
        headers = {
            'Content-Disposition': 'attachment; filename="cleaned_data.xlsx"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download Error: {str(e)}")


@app.post("/analyze")
async def analyze_data(request: AnalysisRequest):
    if not api_key:
        return {"insights": "AI Insights are disabled (No API Key provided)."}
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        # Ensure request summary is clean before stringifying
        clean_summary = clean_for_json(request.summary)
        prompt = f"""
        Analyze this dataset statistical summary and provide 3-4 professional key insights.
        Summary: {json.dumps(clean_summary, indent=2)}
        """
        response = model.generate_content(prompt)
        return {"insights": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/chat")
async def data_chat(request: ChatRequest):
    global current_df
    if current_df is None:
        raise HTTPException(status_code=400, detail="No data uploaded yet.")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key missing.")

    try:
        conn = sqlite3.connect(':memory:')
        # SQLite doesn't like some pandas types, ensure simple values
        current_df.to_sql('data', conn, index=False)
        
        columns = ", ".join(current_df.columns)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        Given SQLite table 'data' with columns: {columns}
        Convert question to single SQLite query. Raw SQL only.
        Question: {request.question}
        """
        sql_response = model.generate_content(prompt).text.strip().replace('```sql', '').replace('```', '')
        
        query_result = pd.read_sql_query(sql_response, conn)
        
        explanation_prompt = f"""
        Question: {request.question}
        Result: {query_result.to_string()}
        Answer concisely.
        """
        final_answer = model.generate_content(explanation_prompt).text
        
        return clean_for_json({
            "query": sql_response,
            "answer": final_answer,
            "table_data": query_result.to_dict(orient='records')
        })
    except Exception as e:
        return {"answer": f"Processing error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
