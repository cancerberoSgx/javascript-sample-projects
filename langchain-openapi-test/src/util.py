from typing import List
import json
from langchain.schema import Document
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores.faiss import FAISS

def dedup(a: List[str])-> List[str]:
	return list(set(a))

def count_tokens(input_text: str):
    return len(dedup(input_text.split()))

def readFile(path:str)->str:
    with open(path) as f:
        content = f.read()
        return content
    
def json2documents(jsonContent:str)->List[str]:
    """
    loads a json document and return a list of strings (texts) printing each product characteristics in a user friendly way
    """
    data = json.loads(jsonContent)['products']
    props = ['title', 'description', 'price', 'discountPercentage', 'rating', 'stock', 'brand', 'category']
    texts = []
    for item in data:
        def ff(prop:str)->str:
            return f"{prop.capitalize()}: {item[prop]}"
        texts.append(". ".join(list(map(ff, props))))
    return texts

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
        # print(count, docCount, count+docCount, count+docCount>tokenLimit)
        if count+docCount>tokenLimit:
          break;
        count=count+docCount
        finalDocs.append(doc)
    return finalDocs

def faiss_order_docs_by_similarity(query: str, texts: List[str])->List[Document]:
    embeddings = OpenAIEmbeddings()
    docsearch = FAISS.from_texts(texts, embeddings)
    docs = docsearch.similarity_search(query, 20)
    return docs