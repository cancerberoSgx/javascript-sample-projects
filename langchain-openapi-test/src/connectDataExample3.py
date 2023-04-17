# loads a large dataset by including only the first N documents so the final prompt fit (less than 4000)
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
import time
from util import count_tokens

openai_api_key = os.environ["OPENAI_API_KEY"]

file_path = Path("assets/100Products.txt")
# file_path = Path("assets/100Products.txt") # fails because of This model's maximum context length is 4097 tokens, however you requested 7381 tokens (7125 in your prompt; 256 for the completion). Please reduce your prompt; or completion length.

# Answer questions about the headlines
def start_conversation(**inputs):
    query = inputs["query"]
    with open(file_path) as f:
        content = f.read()
        text_splitter = CharacterTextSplitter(
            separator="\n",
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        texts = text_splitter.split_text(content)

        # print(query, query.split())
        # Split the text to conform to maximum number of tokens
        start_time = time.time()
        docs = faiss_order_docs_by_similarity(query, texts)
        print(f"Build docs time: {time.time() - start_time :.2f} seconds")
        finalDocs = limitDocs(query, docs, 4000)
        print(f"texts: {len(texts)} vdocs: {len(docs)} finalDocs: {len(finalDocs)}")

        start_time = time.time()
        model = OpenAI(temperature=0.9);
        chain = load_qa_chain(model,chain_type="stuff",)
        res = chain(
            {"input_documents": docs, "question": query}, 
            return_only_outputs=True
        )
        print(f"openIa time: {time.time() - start_time :.2f} seconds")

        print(res)
        return {"pred": res}

def limitDocs(query: str, docs: List[Document], tokenLimit: int):
    """
    trunc given docs so the total tokens fit given limit
    """
    count = count_tokens(query)
    finalDocs = []
    if count>tokenLimit:
      raise Exception("input too big")
    for doc in docs:
        docCount = count_tokens(doc.page_content)
        if count+docCount>tokenLimit:
          break;
        count=count+docCount
        finalDocs.append(doc)
    return finalDocs

def faiss_order_docs_by_similarity(query: str, texts: List[str])->List[Document]:
    embeddings = OpenAIEmbeddings()
    docsearch = FAISS.from_texts(texts, embeddings)
    docs = docsearch.similarity_search(query)
    return docs

if __name__ == "__main__":
    # start_conversation(query="Which phones can I buy with $300?" )
    # # You cannot buy any of the phones listed with $300. The cheapest phone listed is the OPPO F19, which is priced at $280.'

    start_conversation(query="You are a shopping assistant. Document provided represent a list of products to recommend. Please provide concrete list of product suggestions on next prompt: Which phones can I buy with $300?")
    # start_conversation(query="Do you know which is mre durable?")