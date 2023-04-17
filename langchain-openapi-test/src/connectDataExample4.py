# loads a large dataset by including only the first N documents so the final prompt fit (less than 4000)
# same as 3 but adds json parsing - builder

# https://docs.beam.cloud/getting-started/langchain
# install and run instructions:
# pip3.11 install langchain openai tiktoken bs4 faiss-cpu
# python3.11 src/connectDataExample.py

import os
from pathlib import Path
from typing import List
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain.vectorstores.faiss import FAISS
from langchain.chains.question_answering import load_qa_chain
from langchain.llms.openai import OpenAI
from langchain.schema import Document
from util import faiss_order_docs_by_similarity, json2documents, limitDocs, readFile

openai_api_key = os.environ["OPENAI_API_KEY"]
file_path = Path("assets/100Products.json")

# Answer questions about the headlines
def start_conversation(**inputs):
    queryPrefix = "You are a shopping assistant. Document provided represent a list of products to recommend. Please provide concrete list of product suggestions on next prompt: "
    query = queryPrefix + inputs["query"]
    jsonContent=readFile(file_path);
    texts=json2documents(jsonContent)
    # print("\n".join(texts))

    # print(query, query.split())
    # Split the text to conform to maximum number of tokens
    docs = faiss_order_docs_by_similarity(query, texts)
    # print(docs[0].)
    s='. \n'.join(list(map(lambda doc: doc.page_content, docs)))
    print(f"DOCS: \n {s}")
    # finalDocs = limitDocs(query, docs, 3000)
    # print(f"texts: {len(texts)} docs: {len(docs)} finalDocs: {len(finalDocs)}")

    model = OpenAI(temperature=0.9);
    chain = load_qa_chain(model,chain_type="stuff",)
    res = chain(
        {"input_documents": docs, "question": query}, 
        return_only_outputs=True
    )
    print(res)
    return {"pred": res}


if __name__ == "__main__":
    # start_conversation(query="Which phones can I buy with $300?" )
    # # You cannot buy any of the phones listed with $300. The cheapest phone listed is the OPPO F19, which is priced at $280.'
    # start_conversation(query="You are a shopping assistant. Document provided represent a list of products to recommend. Please provide concrete list of product suggestions on next prompt: Which phones can I buy with $300?")
    
    # not working fine - offers 
    start_conversation(query="I'm looking for a car or Motorbike")
