import os
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from supabase import create_client, Client

app= FastAPI()

SUPABASE_URL="https://klldkzitusmrtgyvhkit.supabase.co"
SUPABASE_KEY="sb_publishable_YXzIRGJs1bJwMWmZ2N8CHg_C_-a6K_l"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class ProgramCreate(BaseModel):
    name: str

class ScheduleCreate(BaseModel):
    program_id: str     
    week: str            
    exercise_name: str   
    target_weight: float 
    target_sets: int     
    target_reps: int     

class WorkoutLogCreate(BaseModel):
    schedule_id: str     
    log_name: str       
    actual_weight: float 
    actual_reps: list[int]

@app.get("/")
def home ():
    return {
        "message":"AI fitness Analyzer API Running"
    }

@app.post("/programs")
def create_program(program: ProgramCreate):
    try:
        response = supabase.table("programs").insert({"name":program.name}).execute()

        if len(response.data) == 0:
            raise HTTPException(status_code=400, detail="failed to write to database.")
        
        return {
            "message":"Program successfully saved to database!",
            "data": response.data[0]
        
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/schedules")
def create_schedule(schedule: ScheduleCreate):
    try:

        response = supabase.table("schedules").insert({
            "program_id": schedule.program_id,
            "week": schedule.week,
            "exercise_name": schedule.exercise_name,
            "target_weight": schedule.target_weight,
            "target_sets": schedule.target_sets,
            "target_reps": schedule.target_reps
        }).execute()
        
        if len(response.data) == 0:
            raise HTTPException(status_code=400, detail="Failed to create schedule.")
        return {"message": "Schedule rule saved!", "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/workout-logs")
def create_workout_log(log: WorkoutLogCreate):
    try:
       
        response = supabase.table("workout_logs").insert({
            "schedule_id": log.schedule_id,
            "log_name": log.log_name,
            "actual_weight": log.actual_weight,
            "actual_reps": log.actual_reps 
        }).execute()
        
        if len(response.data) == 0:
            raise HTTPException(status_code=400, detail="Failed to log workout details.")
        return {"message": "Gym workout logged successfully!", "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))@app.get("/programs")
    
@app.get("/programs")
def get_all_programs():
    try:
        response = supabase.table("programs").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/schedules")
def get_schedules_by_program(program_id: str):
    try:
        response = supabase.table("schedules").select("*").eq("program_id", program_id).execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/workout-logs")
def get_logs_by_schedule(schedule_id: str):
    try:
        response = supabase.table("workout_logs").select("*").eq("schedule_id", schedule_id).execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))